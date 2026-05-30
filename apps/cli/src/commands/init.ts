import { mkdir } from 'node:fs/promises'
import { basename } from 'node:path'
import * as p from '@clack/prompts'
import { validateConnection } from '@fakeware/core/shopware'
import { Command } from 'commander'
import pc from 'picocolors'
import terminalLink from 'terminal-link'
import { detectPackageManager, type PackageManager, runInstall } from '../lib/package-manager'
import {
  ScaffoldError,
  type SecretsDest,
  scaffoldProject,
  type WrittenFile,
} from '../lib/scaffolding'
import {
  assertOneOf,
  isEmptyDir,
  normalizeShopUrl,
  resolveTargetDir,
  toValidPackageName,
} from '../lib/utils'
import {
  introBanner,
  promptConfirmSummary,
  promptConnectNow,
  promptPackageManager,
  promptProjectLocation,
  promptShopConnection,
  type SummaryRow,
  withSpinner,
} from '../prompts'

const SECRETS: readonly SecretsDest[] = ['env', 'inline']
const PACKAGE_MANAGERS: readonly PackageManager[] = ['bun', 'npm', 'pnpm', 'yarn']

interface InitFlags {
  url?: string
  clientId?: string
  clientSecret?: string
  output?: string
  secrets: SecretsDest
  packageManager?: PackageManager
  install: boolean
  force: boolean
  yes?: boolean
}

interface InitInputs {
  location: string
  url?: string
  clientId?: string
  clientSecret?: string
  packageManager: PackageManager
}

export function initCommand(): Command {
  return new Command('init')
    .description('Scaffold a project (package.json + typed config + .env) and install config types')
    .option('--url <url>', 'Shopware URL')
    .option('--client-id <id>', 'OAuth2 client ID')
    .option('--client-secret <secret>', 'OAuth2 client secret')
    .option('--output <path>', 'Directory to scaffold into (default: cwd)')
    .option('--secrets <dest>', 'env | inline', 'env')
    .option('--package-manager <pm>', 'bun | npm | pnpm | yarn (default: auto-detect)')
    .option('--no-install', 'Write files but skip dependency install')
    .option('--force', 'Overwrite existing files', false)
    .option('--yes', 'Accept defaults; never prompt')
    .action(async (opts) => {
      await runInit({
        url: opts.url,
        clientId: opts.clientId,
        clientSecret: opts.clientSecret,
        output: opts.output,
        secrets: assertOneOf(opts.secrets, SECRETS, '--secrets'),
        packageManager: opts.packageManager
          ? assertOneOf(opts.packageManager, PACKAGE_MANAGERS, '--package-manager')
          : undefined,
        install: opts.install,
        force: opts.force,
        yes: opts.yes,
      })
    })
}

async function assertTargetUsable(location: string, force: boolean): Promise<void> {
  if (force) return
  const dir = resolveTargetDir(location)
  if (!(await isEmptyDir(dir))) {
    p.cancel(`${dir} is not empty. Choose an empty directory or re-run with ${pc.cyan('--force')}.`)
    process.exit(1)
  }
}

function isNonInteractive(flags: InitFlags): boolean {
  return Boolean(flags.yes || (flags.url && flags.clientId && flags.clientSecret))
}

async function gatherInputs(flags: InitFlags): Promise<InitInputs> {
  if (isNonInteractive(flags)) {
    const location = flags.output ?? '.'
    await assertTargetUsable(location, flags.force)
    return {
      location,
      url: flags.url ? normalizeShopUrl(flags.url) : undefined,
      clientId: flags.clientId,
      clientSecret: flags.clientSecret,
      packageManager:
        flags.packageManager ?? (await detectPackageManager(resolveTargetDir(location))),
    }
  }

  introBanner()

  const location = await promptProjectLocation(flags.output)
  await assertTargetUsable(location, flags.force)

  const packageManager =
    flags.packageManager ??
    (await promptPackageManager(await detectPackageManager(resolveTargetDir(location))))

  const connectNow = await promptConnectNow()
  if (!connectNow) {
    return { location, packageManager }
  }

  const connection = await promptShopConnection({
    url: flags.url,
    clientId: flags.clientId,
    clientSecret: flags.clientSecret,
  })

  await withSpinner(
    `Connecting to ${pc.cyan(connection.url)}`,
    `Connected to ${pc.cyan(connection.url)}`,
    () => validateConnection(connection),
  )

  return { location, ...connection, packageManager }
}

function buildSummaryRows(
  flags: InitFlags,
  inputs: InitInputs,
  dir: string,
  projectName: string,
  connected: boolean,
): SummaryRow[] {
  const rows: SummaryRow[] = [
    { label: 'Directory', value: dir },
    { label: 'Project', value: projectName },
    { label: 'Package manager', value: inputs.packageManager },
    { label: 'Install', value: flags.install ? 'yes' : 'skip' },
    { label: 'Shop', value: connected ? (inputs.url ?? '') : 'not configured' },
    { label: 'Secrets', value: flags.secrets },
  ]
  return rows
}

async function runInit(flags: InitFlags): Promise<void> {
  const inputs = await gatherInputs(flags)

  const dir = resolveTargetDir(inputs.location)
  const projectName = toValidPackageName(basename(dir))
  const connected = Boolean(inputs.url && inputs.clientId && inputs.clientSecret)
  const pm = inputs.packageManager

  if (!isNonInteractive(flags)) {
    const proceed = await promptConfirmSummary(
      buildSummaryRows(flags, inputs, dir, projectName, connected),
    )
    if (!proceed) {
      p.cancel('Setup aborted.')
      process.exit(0)
    }
  }

  let created: WrittenFile[] = []
  let installNote: string | undefined

  try {
    await p.tasks([
      {
        title: 'Creating project files',
        task: async () => {
          await mkdir(dir, { recursive: true })
          created = await scaffoldProject({
            dir,
            force: flags.force,
            values: {
              projectName,
              url: inputs.url,
              clientId: inputs.clientId,
              clientSecret: inputs.clientSecret,
              secrets: flags.secrets,
            },
          })
          const names = created.map((f) => pc.cyan(basename(f.path))).join(', ')
          return `Created ${names}`
        },
      },
      {
        title: `Installing dependencies with ${pm}`,
        enabled: flags.install,
        task: async () => {
          const result = await runInstall(pm, dir)
          if (result.ok) return `Installed dependencies with ${pm}`
          installNote = result.notFound
            ? `${pc.cyan(pm)} was not found on your PATH. Files are written. Run ${pc.cyan(`${pm} install`)} in ${dir} once it's available.`
            : `${result.output.trim().split('\n').slice(-5).join('\n')}\n\nFiles are written. Run ${pc.cyan(`${pm} install`)} in ${dir} to retry.`
          return `Install skipped, see note below`
        },
      },
    ])
  } catch (error) {
    if (error instanceof ScaffoldError) {
      p.cancel(error.message)
      process.exit(1)
    }
    throw error
  }

  if (!flags.install) p.log.info(`Skipped install. Run ${pc.cyan(`${pm} install`)} when ready.`)
  if (installNote) p.log.warn(installNote)

  const docs = terminalLink(pc.cyan('docs.fakeware.sh'), 'https://docs.fakeware.sh', {
    fallback: (text) => text,
  })
  p.outro(`You're all set. Get started at ${docs}.`)
}

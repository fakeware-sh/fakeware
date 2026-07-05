import { mkdir } from 'node:fs/promises'
import { basename } from 'node:path'
import * as p from '@clack/prompts'
import { validateConnection } from '@fakeware/core/shopware'
import { Command } from 'commander'
import pc from 'picocolors'
import terminalLink from 'terminal-link'
import { detectPackageManager, type PackageManager, runInstall } from '../lib/package-manager'
import { type OfficialPlugin, resolvePluginFlag } from '../lib/plugins'
import {
  ScaffoldError,
  type SecretsDest,
  scaffoldProject,
  type WrittenFile,
} from '../lib/scaffolding'
import {
  assertOneOf,
  emptyDir,
  isEmptyDir,
  normalizeShopUrl,
  resolveTargetDir,
  toValidPackageName,
} from '../lib/utils'
import {
  introBanner,
  promptConfirmSummary,
  promptConnectionFailure,
  promptConnectNow,
  promptExistingDir,
  promptPackageManager,
  promptPlugins,
  promptProjectLocation,
  promptShopConnection,
  type ShopConnectionPrefill,
  type SummaryRow,
  validateWithSpinner,
} from '../prompts'

const SECRETS: readonly SecretsDest[] = ['env', 'inline']
const PACKAGE_MANAGERS: readonly PackageManager[] = ['bun', 'npm', 'pnpm', 'yarn']

export interface InitFlags {
  url?: string
  clientId?: string
  clientSecret?: string
  output?: string
  secrets: SecretsDest
  packageManager?: PackageManager
  plugins?: string | false
  install: boolean
  force: boolean
  yes?: boolean
  dryRun: boolean
}

interface InitInputs {
  location: string
  url?: string
  clientId?: string
  clientSecret?: string
  packageManager: PackageManager
  plugins: OfficialPlugin[]
  dirStrategy: 'remove' | 'ignore' | 'fresh'
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
    .option('--plugins <list>', 'Official plugin ids to add (comma-separated), or "all" | "none"')
    .option('--no-plugins', 'Do not add any official plugins')
    .option('--no-install', 'Write files but skip dependency install')
    .option('--force', 'Overwrite existing files', false)
    .option('--dry-run', 'Preview the files that would be written without writing them', false)
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
        plugins: opts.plugins,
        install: opts.install,
        force: opts.force,
        dryRun: opts.dryRun,
        yes: opts.yes,
      })
    })
}

export function isInteractive(isTTY: boolean | undefined = process.stdin.isTTY): boolean {
  return Boolean(isTTY)
}

export function isNonInteractive(
  flags: InitFlags,
  interactive: boolean = isInteractive(),
): boolean {
  if (!interactive) return true
  return Boolean(flags.yes || (flags.url && flags.clientId && flags.clientSecret))
}

async function assertTargetUsable(location: string, flags: InitFlags): Promise<void> {
  if (flags.force || flags.dryRun) return
  const dir = resolveTargetDir(location)
  if (!(await isEmptyDir(dir))) {
    p.cancel(
      `${dir} is not empty. Re-run with ${pc.cyan('--force')} to write over it, or choose an empty directory.`,
    )
    process.exit(1)
  }
}

async function resolveDirStrategy(
  location: string,
  flags: InitFlags,
): Promise<InitInputs['dirStrategy']> {
  if (flags.force) return 'ignore'
  const dir = resolveTargetDir(location)
  if (await isEmptyDir(dir)) return 'fresh'

  const choice = await promptExistingDir(dir)
  if (choice === 'cancel') {
    p.cancel('Setup aborted.')
    process.exit(0)
  }
  return choice
}

async function gatherConnection(
  flags: InitFlags,
): Promise<Pick<InitInputs, 'url' | 'clientId' | 'clientSecret'>> {
  const connectNow = await promptConnectNow()
  if (!connectNow) return {}

  let prefill: ShopConnectionPrefill = {
    url: flags.url,
    clientId: flags.clientId,
    clientSecret: flags.clientSecret,
  }
  let connection = await promptShopConnection(prefill)

  while (true) {
    const error = await validateWithSpinner(
      `Connecting to ${pc.cyan(connection.url)}`,
      `Connected to ${pc.cyan(connection.url)}`,
      () => validateConnection(connection),
    )
    if (!error) return connection

    const choice = await promptConnectionFailure()
    if (choice === 'cancel') {
      p.cancel('Setup aborted.')
      process.exit(1)
    }
    if (choice === 'skip') return {}
    if (choice === 'edit') {
      prefill = { ...connection }
      connection = await promptShopConnection(prefill, { edit: true })
    }
  }
}

export async function resolvePlugins(
  flags: InitFlags,
  fallback: () => Promise<OfficialPlugin[]>,
): Promise<OfficialPlugin[]> {
  if (flags.plugins === false) return []
  if (typeof flags.plugins === 'string') return resolvePluginFlag(flags.plugins)
  return fallback()
}

async function gatherInputs(flags: InitFlags): Promise<InitInputs> {
  if (isNonInteractive(flags)) {
    const location = flags.output ?? '.'
    await assertTargetUsable(location, flags)
    return {
      location,
      url: flags.url ? normalizeShopUrl(flags.url) : undefined,
      clientId: flags.clientId,
      clientSecret: flags.clientSecret,
      packageManager:
        flags.packageManager ?? (await detectPackageManager(resolveTargetDir(location))),
      plugins: await resolvePlugins(flags, async () => []),
      dirStrategy: 'fresh',
    }
  }

  introBanner()

  const location = await promptProjectLocation(flags.output)
  const dirStrategy = await resolveDirStrategy(location, flags)

  const packageManager =
    flags.packageManager ??
    (await promptPackageManager(await detectPackageManager(resolveTargetDir(location))))

  const connection = await gatherConnection(flags)

  const plugins = await resolvePlugins(flags, promptPlugins)

  return { location, ...connection, packageManager, plugins, dirStrategy }
}

function buildSummaryRows(
  flags: InitFlags,
  inputs: InitInputs,
  dir: string,
  projectName: string,
  connected: boolean,
): SummaryRow[] {
  return [
    { label: 'Directory', value: dir },
    { label: 'Project', value: projectName },
    { label: 'Package manager', value: inputs.packageManager },
    { label: 'Install', value: flags.dryRun ? 'dry run' : flags.install ? 'yes' : 'skip' },
    { label: 'Shop', value: connected ? (inputs.url ?? '') : 'not configured' },
    {
      label: 'Plugins',
      value: inputs.plugins.length ? inputs.plugins.map((plugin) => plugin.id).join(', ') : 'none',
    },
    { label: 'Secrets', value: flags.secrets },
  ]
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

  const install = flags.install && !flags.dryRun
  let created: WrittenFile[] = []
  let installNote: string | undefined

  try {
    await p.tasks([
      {
        title: flags.dryRun ? 'Previewing project files' : 'Creating project files',
        task: async () => {
          if (!flags.dryRun) {
            await mkdir(dir, { recursive: true })
            if (inputs.dirStrategy === 'remove') await emptyDir(dir)
          }
          created = await scaffoldProject({
            dir,
            force: flags.force || inputs.dirStrategy !== 'fresh',
            dryRun: flags.dryRun,
            values: {
              projectName,
              url: inputs.url,
              clientId: inputs.clientId,
              clientSecret: inputs.clientSecret,
              secrets: flags.secrets,
              plugins: inputs.plugins,
            },
          })
          const names = created.map((f) => pc.cyan(basename(f.path))).join(', ')
          return flags.dryRun ? `Would create ${names}` : `Created ${names}`
        },
      },
      {
        title: `Installing dependencies with ${pm}`,
        enabled: install,
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

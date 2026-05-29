import { mkdir } from 'node:fs/promises'
import { basename } from 'node:path'
import * as p from '@clack/prompts'
import { fetchShopInfo, validateConnection } from '@fakeware/core/shopware'
import { Command } from 'commander'
import pc from 'picocolors'
import { detectPackageManager, type PackageManager, runInstall } from '../lib/package-manager'
import {
  CONFIG_FILE_NAME,
  ScaffoldError,
  type SecretsDest,
  scaffoldProject,
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
  promptConnectNow,
  promptPackageManager,
  promptProjectLocation,
  promptShopConnection,
  promptShopLocale,
  withSpinner,
} from '../prompts'

const SECRETS: readonly SecretsDest[] = ['env', 'inline']
const PACKAGE_MANAGERS: readonly PackageManager[] = ['bun', 'npm', 'pnpm', 'yarn']

interface InitFlags {
  url?: string
  clientId?: string
  clientSecret?: string
  scenario?: string
  locale?: string
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
  locale?: string
  packageManager: PackageManager
}

export function initCommand(): Command {
  return new Command('init')
    .description('Scaffold a project (package.json + typed config + .env) and install config types')
    .option('--url <url>', 'Shopware URL')
    .option('--client-id <id>', 'OAuth2 client ID')
    .option('--client-secret <secret>', 'OAuth2 client secret')
    .option('--scenario <name>', 'Starting scenario (recorded into config)')
    .option('--locale <locale>', 'Default locale')
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
        scenario: opts.scenario,
        locale: opts.locale,
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

async function gatherInputs(flags: InitFlags): Promise<InitInputs> {
  const hasCreds = Boolean(flags.url && flags.clientId && flags.clientSecret)

  if (flags.yes || hasCreds) {
    const location = flags.output ?? '.'
    await assertTargetUsable(location, flags.force)
    return {
      location,
      url: flags.url ? normalizeShopUrl(flags.url) : undefined,
      clientId: flags.clientId,
      clientSecret: flags.clientSecret,
      locale: flags.locale,
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
    return { location, locale: flags.locale, packageManager }
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

  const info = await withSpinner('Reading shop languages', 'Read shop languages', () =>
    fetchShopInfo(connection),
  )
  const locale = await promptShopLocale(info, flags.locale)

  return { location, ...connection, locale, packageManager }
}

async function runInit(flags: InitFlags): Promise<void> {
  const inputs = await gatherInputs(flags)

  const dir = resolveTargetDir(inputs.location)
  const projectName = toValidPackageName(basename(dir))

  await mkdir(dir, { recursive: true })

  const connected = Boolean(inputs.url && inputs.clientId && inputs.clientSecret)

  let created: Awaited<ReturnType<typeof scaffoldProject>>
  try {
    created = await scaffoldProject({
      dir,
      force: flags.force,
      values: {
        projectName,
        url: inputs.url,
        clientId: inputs.clientId,
        clientSecret: inputs.clientSecret,
        locale: inputs.locale,
        scenario: flags.scenario,
        secrets: flags.secrets,
      },
    })
  } catch (error) {
    if (error instanceof ScaffoldError) {
      p.cancel(error.message)
      process.exit(1)
    }
    throw error
  }

  for (const file of created) {
    p.log.success(`Created ${pc.cyan(basename(file.path))}  ${pc.dim(`(${file.note})`)}`)
  }

  const pm = inputs.packageManager

  if (flags.install) {
    const s = p.spinner()
    s.start(`Installing dependencies with ${pm}`)
    const result = await runInstall(pm, dir)
    if (result.ok) {
      s.stop(`Installed dependencies with ${pm}`)
    } else if (result.notFound) {
      s.stop('Install failed')
      p.log.warn(
        `${pc.cyan(pm)} was not found on your PATH, install it or re-run with ${pc.cyan('--package-manager')}.\n\nYour files are written, run ${pc.cyan(`${pm} install`)} in ${dir} once it's available.`,
      )
    } else {
      s.stop('Install failed')
      const tail = result.output.trim().split('\n').slice(-5).join('\n')
      p.log.warn(
        `${tail}\n\nYour files are written — run ${pc.cyan(`${pm} install`)} in ${dir} to retry.`,
      )
    }
  } else {
    p.log.info(`Skipped install. Run ${pc.cyan(`${pm} install`)} when ready.`)
  }

  const config = pc.cyan(CONFIG_FILE_NAME)
  p.outro(
    connected
      ? `Next: edit ${config}, then run ${pc.cyan('fakeware seed')}.`
      : `Next: build out ${config}, then add a shopware block when ready to run ${pc.cyan('fakeware seed')}.`,
  )
}

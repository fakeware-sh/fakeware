import { mkdir } from 'node:fs/promises'
import { basename } from 'node:path'
import * as p from '@clack/prompts'
import { Command } from 'commander'
import pc from 'picocolors'
import { detectPackageManager, type PackageManager, runInstall } from '../lib/package-manager'
import {
  type ConfigFormat,
  configFileName,
  ScaffoldError,
  type SecretsDest,
  scaffoldProject,
} from '../lib/scaffolding'
import { fetchShopInfo, validateShopConnection } from '../lib/shop'
import { assertOneOf, normalizeShopUrl, resolveTargetDir, toValidPackageName } from '../lib/utils'
import {
  introBanner,
  promptPackageManager,
  promptProjectLocation,
  promptShopConnection,
  promptShopLocale,
} from '../prompts'

const FORMATS: readonly ConfigFormat[] = ['ts', 'js', 'yaml', 'json']
const SECRETS: readonly SecretsDest[] = ['env', 'inline', 'keychain']
const PACKAGE_MANAGERS: readonly PackageManager[] = ['bun', 'npm', 'pnpm', 'yarn']

interface InitFlags {
  url?: string
  clientId?: string
  clientSecret?: string
  scenario?: string
  locale?: string
  format: ConfigFormat
  output?: string
  secrets: SecretsDest
  packageManager?: PackageManager
  install: boolean
  force: boolean
  yes?: boolean
}

interface InitInputs {
  location: string
  url: string
  clientId: string
  clientSecret: string
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
    .option('--format <fmt>', 'ts | js | yaml | json', 'ts')
    .option('--output <path>', 'Directory to scaffold into (default: cwd)')
    .option('--secrets <dest>', 'env | inline | keychain', 'env')
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
        format: assertOneOf(opts.format, FORMATS, '--format'),
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

async function gatherInputs(flags: InitFlags): Promise<InitInputs> {
  const complete = Boolean(flags.url && flags.clientId && flags.clientSecret)
  if (flags.yes || complete) {
    const location = flags.output ?? '.'
    return {
      location,
      url: flags.url ? normalizeShopUrl(flags.url) : '',
      clientId: flags.clientId ?? '',
      clientSecret: flags.clientSecret ?? '',
      locale: flags.locale,
      packageManager:
        flags.packageManager ?? (await detectPackageManager(resolveTargetDir(location))),
    }
  }

  introBanner()

  const location = await promptProjectLocation(flags.output)

  const connection = await promptShopConnection({
    url: flags.url,
    clientId: flags.clientId,
    clientSecret: flags.clientSecret,
  })

  await validateShopConnection(connection)
  p.log.info(
    `Saved credentials for ${pc.cyan(connection.url)} (not yet verified against the shop).`,
  )

  const info = await fetchShopInfo(connection)
  const locale = await promptShopLocale(info, flags.locale)

  const packageManager =
    flags.packageManager ??
    (await promptPackageManager(await detectPackageManager(resolveTargetDir(location))))

  return { location, ...connection, locale, packageManager }
}

async function runInit(flags: InitFlags): Promise<void> {
  const inputs = await gatherInputs(flags)

  const dir = resolveTargetDir(inputs.location)
  const projectName = toValidPackageName(basename(dir))

  await mkdir(dir, { recursive: true })

  let created: Awaited<ReturnType<typeof scaffoldProject>>
  try {
    created = await scaffoldProject({
      dir,
      format: flags.format,
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

  p.outro(
    `Next: edit ${pc.cyan(configFileName(flags.format))}, then run ${pc.cyan('fakeware seed')}.`,
  )
}

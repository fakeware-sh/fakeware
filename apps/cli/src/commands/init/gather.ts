import * as p from '@clack/prompts'
import { validateConnection } from '@fakeware/core/shopware'
import pc from 'picocolors'
import { EXIT_CANCELLED, EXIT_FAILURE, EXIT_OK, exit } from '../../lib/exit-codes'
import { detectPackageManager, type PackageManager } from '../../lib/package-manager'
import { type OfficialPlugin, resolvePluginFlag } from '../../lib/plugins'
import { isEmptyDir, normalizeShopUrl, resolveTargetDir } from '../../lib/utils'
import {
  introBanner,
  promptConnectionFailure,
  promptConnectNow,
  promptExampleData,
  promptExistingDir,
  promptPackageManager,
  promptPlugins,
  promptProjectLocation,
  promptShopConnection,
  type ShopConnectionPrefill,
  validateWithSpinner,
} from '../../prompts'
import type { InitFlags } from './flags'

export interface InitInputs {
  location: string
  url?: string
  clientId?: string
  clientSecret?: string
  packageManager: PackageManager
  plugins: OfficialPlugin[]
  exampleData: boolean
  dirStrategy: 'remove' | 'ignore' | 'fresh'
}

export function isInteractive(isTTY: boolean | undefined = process.stdin.isTTY): boolean {
  return Boolean(isTTY)
}

export function hasFullConnection(flags: InitFlags): boolean {
  return Boolean(flags.url && flags.clientId && flags.clientSecret)
}

export function isNonInteractive(
  flags: InitFlags,
  interactive: boolean = isInteractive(),
): boolean {
  if (!interactive) return true
  return Boolean(flags.yes || hasFullConnection(flags))
}

export function warnImplicitYes(flags: InitFlags, interactive: boolean = isInteractive()): boolean {
  if (!interactive || flags.yes || !hasFullConnection(flags)) return false
  p.log.warn(
    `Running non-interactively because ${pc.cyan('--url')}, ${pc.cyan('--client-id')} and ${pc.cyan('--client-secret')} were all given. Pass ${pc.cyan('--yes')} to silence this, or drop one flag to be prompted.`,
  )
  return true
}

async function assertTargetUsable(location: string, flags: InitFlags): Promise<void> {
  if (flags.force || flags.dryRun) return
  const dir = resolveTargetDir(location)
  if (!(await isEmptyDir(dir))) {
    p.cancel(
      `${dir} is not empty. Re-run with ${pc.cyan('--force')} to write over it, or choose an empty directory.`,
    )
    exit(EXIT_FAILURE)
  }
}

async function warnDryRunCollision(location: string, flags: InitFlags): Promise<void> {
  if (!flags.dryRun || flags.force) return
  const dir = resolveTargetDir(location)
  if (await isEmptyDir(dir)) return
  p.log.warn(
    `${dir} is not empty. A real run would refuse to write here without ${pc.cyan('--force')}.`,
  )
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
    exit(EXIT_CANCELLED)
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
      exit(EXIT_CANCELLED)
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

export async function resolveExampleData(
  flags: InitFlags,
  fallback: () => Promise<boolean>,
): Promise<boolean> {
  if (flags.template === 'plugin') return false
  if (flags.exampleData === false) return false
  return fallback()
}

function noPluginsNonInteractive(): Promise<OfficialPlugin[]> {
  p.log.info(
    `No plugins added. Pass ${pc.cyan('--plugins <list>')} or ${pc.cyan('--plugins all')} to include official plugins.`,
  )
  return Promise.resolve([])
}

export async function gatherInputs(flags: InitFlags): Promise<InitInputs> {
  if (isNonInteractive(flags)) {
    warnImplicitYes(flags)
    const location = flags.output ?? '.'
    await assertTargetUsable(location, flags)
    await warnDryRunCollision(location, flags)
    return {
      location,
      url: flags.url ? normalizeShopUrl(flags.url) : undefined,
      clientId: flags.clientId,
      clientSecret: flags.clientSecret,
      packageManager:
        flags.packageManager ?? (await detectPackageManager(resolveTargetDir(location))),
      plugins: await resolvePlugins(flags, noPluginsNonInteractive),
      exampleData: await resolveExampleData(flags, async () => true),
      dirStrategy: 'fresh',
    }
  }

  introBanner()

  const location = await promptProjectLocation(flags.output)
  const dirStrategy = await resolveDirStrategy(location, flags)
  await warnDryRunCollision(location, flags)

  const packageManager =
    flags.packageManager ??
    (await promptPackageManager(await detectPackageManager(resolveTargetDir(location))))

  const connection = flags.template === 'plugin' ? {} : await gatherConnection(flags)
  const plugins = flags.template === 'plugin' ? [] : await resolvePlugins(flags, promptPlugins)
  const exampleData = await resolveExampleData(flags, promptExampleData)

  return { location, ...connection, packageManager, plugins, exampleData, dirStrategy }
}

export function abortUnconfirmed(): never {
  p.cancel('Setup aborted.')
  exit(EXIT_OK)
}

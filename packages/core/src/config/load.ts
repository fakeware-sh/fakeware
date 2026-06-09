import { access, readFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { type FakewarePlugin, loadPlugins } from '../plugin'
import { loadModule } from '../runtime'
import type { ShopwareConnection } from '../shopware'
import type { ConfigEnv, FakewareConfigFn } from './define'
import { ConfigError } from './errors'
import { interpolate } from './interpolate'
import { type FakewareConfig, type FakewareUserConfig, fakewareConfigSchema } from './schema'

export const DEFAULT_CONFIG_FILENAME = 'fakeware.config.ts'

export interface LoadConfigOptions {
  cwd?: string
  configFile?: string
  mode?: string
}

export interface LoadedConfig {
  config: FakewareConfig
  connection: ShopwareConnection
  configPath: string
  projectRoot: string
  plugins: FakewarePlugin[]
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function findConfig(cwd: string): Promise<string> {
  let dir = cwd
  for (;;) {
    const candidate = join(dir, DEFAULT_CONFIG_FILENAME)
    if (await fileExists(candidate)) return candidate
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new ConfigError(
    `No ${DEFAULT_CONFIG_FILENAME} found in ${cwd} or any parent directory. Run \`fakeware init\` first.`,
  )
}

async function readEnvFile(projectRoot: string): Promise<Record<string, string>> {
  const path = join(projectRoot, '.env')
  if (!(await fileExists(path))) return {}
  const out: Record<string, string> = {}
  const contents = await readFile(path, 'utf8')
  for (const raw of contents.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    out[key] = val
  }
  return out
}

function isConfigFn(value: unknown): value is FakewareConfigFn {
  return typeof value === 'function'
}

export async function loadConfig(opts: LoadConfigOptions = {}): Promise<LoadedConfig> {
  const cwd = opts.cwd ?? process.cwd()
  const configPath = opts.configFile
    ? isAbsolute(opts.configFile)
      ? opts.configFile
      : resolve(cwd, opts.configFile)
    : await findConfig(cwd)
  const projectRoot = dirname(configPath)

  const env: Record<string, string | undefined> = {
    ...process.env,
    ...(await readEnvFile(projectRoot)),
  }

  const mod = await loadModule<{ default?: unknown }>(configPath)
  const exported = mod.default
  if (exported === undefined) {
    throw new ConfigError(`${configPath} must \`export default defineConfig(...)\`.`)
  }

  const configEnv: ConfigEnv = { env, mode: opts.mode ?? 'development' }
  const raw = isConfigFn(exported) ? exported(configEnv) : (exported as FakewareUserConfig)

  const interpolated = interpolate(raw, env)

  const parsed = fakewareConfigSchema.safeParse(interpolated)
  if (!parsed.success) {
    throw new ConfigError(`Invalid config in ${configPath}: ${parsed.error.message}`)
  }

  const { shopware } = parsed.data
  if (!shopware) {
    throw new ConfigError(
      `No \`shopware\` connection configured in ${configPath}. up/down need a shop to talk to.`,
    )
  }

  const plugins = loadPlugins(raw.plugins)

  return {
    config: parsed.data,
    connection: shopware,
    configPath,
    projectRoot,
    plugins,
  }
}

import { generateCode, loadFile, type ProxifiedModule, parseModule, writeFile } from 'magicast'
import { credentialValues, hasShopConnection, type ScaffoldValues } from './values'

const SEED =
  "import { defineConfig } from '@fakeware/core/config'\n\nexport default defineConfig({})\n"

const CODE_FORMAT = { quote: 'single' as const, trailingComma: true }
const GENERATE_OPTIONS = { format: CODE_FORMAT }

type ConfigObject = Record<string, unknown>

function configArg(mod: ProxifiedModule): ConfigObject {
  const def = mod.exports.default
  if (def.$type !== 'function-call') {
    throw new Error('fakeware.config.ts must export `defineConfig({ ... })` as default.')
  }
  return def.$args[0] as ConfigObject
}

export function applyConfig(cfg: ConfigObject, values: ScaffoldValues): void {
  if (hasShopConnection(values)) {
    const c = credentialValues(values)
    cfg.shopware = { url: c.url, clientId: c.clientId, clientSecret: c.clientSecret }
  }
  if (values.locale) cfg.locale = values.locale
  if (values.scenario) cfg.scenario = values.scenario
  cfg.generators ??= {}
}

export function buildConfigFile(values: ScaffoldValues): string {
  const mod = parseModule(SEED)
  applyConfig(configArg(mod), values)
  let { code } = generateCode(mod, GENERATE_OPTIONS)
  code = code.replace(/\n\n(?=\s)/g, '\n')
  return code.endsWith('\n') ? code : `${code}\n`
}

export async function addToConfigFile(
  path: string,
  mutate: (cfg: ConfigObject) => void,
): Promise<void> {
  const mod = await loadFile(path)
  mutate(configArg(mod))
  await writeFile(mod, path, CODE_FORMAT)
}

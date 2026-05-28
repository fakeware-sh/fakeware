import pkg from '../../package.json' with { type: 'json' }

export const CORE_VERSION = `^${pkg.version}`

export type ConfigFormat = 'ts' | 'js' | 'yaml' | 'json'

export type SecretsDest = 'env' | 'inline' | 'keychain'

export interface ScaffoldValues {
  projectName: string
  url: string
  clientId: string
  clientSecret: string
  locale?: string
  scenario?: string
  secrets: SecretsDest
}

export function configFileName(format: ConfigFormat): string {
  return `fakeware.config.${format}`
}

export function packageJsonTemplate(values: ScaffoldValues): string {
  const pkg = {
    name: values.projectName,
    private: true,
    type: 'module',
    devDependencies: {
      '@fakeware-sh/core': CORE_VERSION,
    },
  }
  return `${JSON.stringify(pkg, null, 2)}\n`
}

function credentialValues(values: ScaffoldValues): {
  url: string
  clientId: string
  clientSecret: string
} {
  if (values.secrets === 'env') {
    return {
      url: '$SHOPWARE_URL',
      clientId: '$SHOPWARE_CLIENT_ID',
      clientSecret: '$SHOPWARE_CLIENT_SECRET',
    }
  }
  return {
    url: values.url,
    clientId: values.clientId,
    clientSecret: values.clientSecret,
  }
}

function tsLikeTemplate(values: ScaffoldValues, importLine: string): string {
  const c = credentialValues(values)
  const lines = [
    importLine,
    '',
    'export default defineConfig({',
    '  shopware: {',
    `    url: ${JSON.stringify(c.url)},`,
    `    clientId: ${JSON.stringify(c.clientId)},`,
    `    clientSecret: ${JSON.stringify(c.clientSecret)},`,
    '  },',
  ]
  if (values.locale) lines.push(`  locale: ${JSON.stringify(values.locale)},`)
  if (values.scenario) lines.push(`  scenario: ${JSON.stringify(values.scenario)},`)
  lines.push('  generators: {},', '})', '')
  return lines.join('\n')
}

function yamlTemplate(values: ScaffoldValues): string {
  const c = credentialValues(values)
  const lines = [
    'shopware:',
    `  url: ${c.url}`,
    `  clientId: ${c.clientId}`,
    `  clientSecret: ${c.clientSecret}`,
  ]
  if (values.locale) lines.push(`locale: ${values.locale}`)
  if (values.scenario) lines.push(`scenario: ${values.scenario}`)
  lines.push('generators: {}', '')
  return lines.join('\n')
}

function jsonTemplate(values: ScaffoldValues): string {
  const c = credentialValues(values)
  const config: Record<string, unknown> = {
    shopware: { url: c.url, clientId: c.clientId, clientSecret: c.clientSecret },
    generators: {},
  }
  if (values.locale) config.locale = values.locale
  if (values.scenario) config.scenario = values.scenario
  return `${JSON.stringify(config, null, 2)}\n`
}

export function configTemplate(values: ScaffoldValues, format: ConfigFormat): string {
  switch (format) {
    case 'ts':
    case 'js':
      return tsLikeTemplate(values, "import { defineConfig } from '@fakeware-sh/core/config'")
    case 'yaml':
      return yamlTemplate(values)
    case 'json':
      return jsonTemplate(values)
  }
}

export function envTemplate(values: ScaffoldValues): string {
  return [
    `SHOPWARE_URL=${values.url}`,
    `SHOPWARE_CLIENT_ID=${values.clientId}`,
    `SHOPWARE_CLIENT_SECRET=${values.clientSecret}`,
    '',
  ].join('\n')
}

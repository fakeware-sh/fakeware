import pkg from '../../../package.json' with { type: 'json' }

export const CORE_VERSION = `^${pkg.version}`

export type SecretsDest = 'env' | 'inline' | 'keychain'

export const CONFIG_FILE_NAME = 'fakeware.config.ts'

export interface ScaffoldValues {
  projectName: string
  url?: string
  clientId?: string
  clientSecret?: string
  locale?: string
  scenario?: string
  secrets: SecretsDest
}

export function hasShopConnection(values: ScaffoldValues): boolean {
  return Boolean(values.url && values.clientId && values.clientSecret)
}

export function packageJsonTemplate(values: ScaffoldValues): string {
  const pkg = {
    name: values.projectName,
    private: true,
    type: 'module',
    devDependencies: {
      '@fakeware/core': CORE_VERSION,
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
    url: values.url ?? '',
    clientId: values.clientId ?? '',
    clientSecret: values.clientSecret ?? '',
  }
}

export function configTemplate(values: ScaffoldValues): string {
  const lines = [
    "import { defineConfig } from '@fakeware/core/config'",
    '',
    'export default defineConfig({',
  ]
  if (hasShopConnection(values)) {
    const c = credentialValues(values)
    lines.push(
      '  shopware: {',
      `    url: ${JSON.stringify(c.url)},`,
      `    clientId: ${JSON.stringify(c.clientId)},`,
      `    clientSecret: ${JSON.stringify(c.clientSecret)},`,
      '  },',
    )
  } else {
    lines.push('  // Add a shopware block when ready to seed a live shop.')
  }
  if (values.locale) lines.push(`  locale: ${JSON.stringify(values.locale)},`)
  if (values.scenario) lines.push(`  scenario: ${JSON.stringify(values.scenario)},`)
  lines.push('  generators: {},', '})', '')
  return lines.join('\n')
}

export function envTemplate(values: ScaffoldValues): string {
  return [
    `SHOPWARE_URL=${values.url}`,
    `SHOPWARE_CLIENT_ID=${values.clientId}`,
    `SHOPWARE_CLIENT_SECRET=${values.clientSecret}`,
    '',
  ].join('\n')
}

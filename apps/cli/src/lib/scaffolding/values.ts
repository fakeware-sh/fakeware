import type { OfficialPlugin } from '../plugins'

export const CONFIG_FILE_NAME = 'fakeware.config.ts'

export type SecretsDest = 'env' | 'inline'

export type ScaffoldTemplate = 'project' | 'plugin'

export const SCAFFOLD_TEMPLATES: ScaffoldTemplate[] = ['project', 'plugin']

export interface ScaffoldValues {
  projectName: string
  url?: string
  clientId?: string
  clientSecret?: string
  secrets: SecretsDest
  plugins: OfficialPlugin[]
  template?: ScaffoldTemplate
}

export function templateOf(values: ScaffoldValues): ScaffoldTemplate {
  return values.template ?? 'project'
}

export function isPluginTemplate(values: ScaffoldValues): boolean {
  return templateOf(values) === 'plugin'
}

export function isProjectTemplate(values: ScaffoldValues): boolean {
  return templateOf(values) === 'project'
}

export function hasShopConnection(values: ScaffoldValues): boolean {
  return Boolean(values.url && values.clientId && values.clientSecret)
}

export function credentialValues(values: ScaffoldValues): {
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

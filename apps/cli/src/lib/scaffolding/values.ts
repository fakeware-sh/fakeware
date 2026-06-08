export const CONFIG_FILE_NAME = 'fakeware.config.ts'

export type SecretsDest = 'env' | 'inline'

export interface ScaffoldValues {
  projectName: string
  url?: string
  clientId?: string
  clientSecret?: string
  secrets: SecretsDest
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

export interface ShopConnection {
  url: string
  clientId: string
  clientSecret: string
}

export interface ShopInfo {
  locales: string[]
  defaultLocale: string
}

const FALLBACK_LOCALES = ['de-DE', 'en-US', 'en-GB']

export async function validateShopConnection(connection: ShopConnection): Promise<void> {
  void connection
}

export async function fetchShopInfo(connection: ShopConnection): Promise<ShopInfo> {
  void connection
  return { locales: FALLBACK_LOCALES, defaultLocale: FALLBACK_LOCALES[0] as string }
}

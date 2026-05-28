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

export async function validateShopConnection(_connection: ShopConnection): Promise<void> {
  await new Promise((r) => setTimeout(r, 1200))
}

export async function fetchShopInfo(_connection: ShopConnection): Promise<ShopInfo> {
  await new Promise((r) => setTimeout(r, 600))
  return { locales: FALLBACK_LOCALES, defaultLocale: FALLBACK_LOCALES[0] as string }
}

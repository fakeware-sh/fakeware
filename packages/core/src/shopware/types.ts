export interface ShopwareConnection {
  url: string
  clientId: string
  clientSecret: string
}

export interface ShopInfo {
  locales: string[]
  defaultLocale: string
}

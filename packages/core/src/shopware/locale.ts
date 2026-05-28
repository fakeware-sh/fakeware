import { ShopwareConnectionError } from './errors'
import type { ShopInfo } from './types'

const SYSTEM_LANGUAGE_ID = '2fbb5fe2e29a4d70aa5854ce7ce3e20b'

export interface LanguageRow {
  id: string
  locale?: { code?: string } | null
}

export function toShopInfo(rows: LanguageRow[]): ShopInfo {
  const seen = new Set<string>()
  const locales: string[] = []
  let systemLocale: string | undefined

  for (const row of rows) {
    const code = row.locale?.code
    if (!code) continue
    if (row.id === SYSTEM_LANGUAGE_ID) systemLocale = code
    if (!seen.has(code)) {
      seen.add(code)
      locales.push(code)
    }
  }

  if (locales.length === 0) {
    throw new ShopwareConnectionError('Shopware returned no usable locales.')
  }

  return { locales, defaultLocale: systemLocale ?? (locales[0] as string) }
}

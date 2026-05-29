import { z } from 'zod'
import { ShopwareConnectionError } from './errors'
import type { ShopInfo } from './types'

const SYSTEM_LANGUAGE_ID = '2fbb5fe2e29a4d70aa5854ce7ce3e20b'

const languageRowSchema = z.object({
  id: z.string(),
  locale: z.object({ code: z.string().optional() }).nullish(),
})

export type LanguageRow = z.infer<typeof languageRowSchema>

export function parseLanguageRows(rows: unknown): LanguageRow[] {
  const result = z.array(languageRowSchema).safeParse(rows)
  if (!result.success) {
    throw new ShopwareConnectionError(
      'Shopware returned an unexpected response shape for languages.',
    )
  }
  return result.data
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

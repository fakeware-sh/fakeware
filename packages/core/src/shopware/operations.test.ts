import { describe, expect, test } from 'bun:test'
import { type LanguageRow, toShopInfo } from './locale'

const SYSTEM_LANGUAGE_ID = '2fbb5fe2e29a4d70aa5854ce7ce3e20b'

describe('toShopInfo', () => {
  test('maps language rows to unique locale codes', () => {
    const rows: LanguageRow[] = [
      { id: 'a', locale: { code: 'de-DE' } },
      { id: 'b', locale: { code: 'en-GB' } },
    ]
    expect(toShopInfo(rows)).toEqual({
      locales: ['de-DE', 'en-GB'],
      defaultLocale: 'de-DE',
    })
  })

  test('uses the system language as the default locale', () => {
    const rows: LanguageRow[] = [
      { id: 'a', locale: { code: 'de-DE' } },
      { id: SYSTEM_LANGUAGE_ID, locale: { code: 'en-GB' } },
    ]
    expect(toShopInfo(rows).defaultLocale).toBe('en-GB')
  })

  test('deduplicates repeated locale codes', () => {
    const rows: LanguageRow[] = [
      { id: 'a', locale: { code: 'en-GB' } },
      { id: 'b', locale: { code: 'en-GB' } },
    ]
    expect(toShopInfo(rows).locales).toEqual(['en-GB'])
  })

  test('skips rows without a locale code', () => {
    const rows: LanguageRow[] = [
      { id: 'a', locale: null },
      { id: 'b', locale: { code: 'fr-FR' } },
    ]
    expect(toShopInfo(rows).locales).toEqual(['fr-FR'])
  })

  test('throws when no usable locales are present', () => {
    expect(() => toShopInfo([])).toThrow('Shopware returned no usable locales.')
    expect(() => toShopInfo([{ id: 'a', locale: null }])).toThrow()
  })
})

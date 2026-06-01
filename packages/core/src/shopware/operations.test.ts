import { describe, expect, mock, test } from 'bun:test'
import { ApiClientError, type ApiError } from '@shopware/api-client'
import type { ShopwareClient } from './client'
import { ShopwareConnectionError } from './errors'
import { type LanguageRow, parseLanguageRows, toShopInfo } from './locale'
import type { ShopwareConnection } from './types'

let nextInvoke: (action: string, args?: unknown) => Promise<unknown> = async () => ({ data: {} })

mock.module('./client', () => ({
  REQUEST_TIMEOUT_MS: 120_000,
  createShopwareClient: (): ShopwareClient =>
    ({ invoke: (action: string, args?: unknown) => nextInvoke(action, args) }) as ShopwareClient,
}))

const { toConnectionError, validateConnection, fetchShopInfo } = await import('./operations')

const SYSTEM_LANGUAGE_ID = '2fbb5fe2e29a4d70aa5854ce7ce3e20b'

const connection: ShopwareConnection = {
  url: 'https://shop.test',
  clientId: 'i',
  clientSecret: 's',
}

function apiError(status: number, errors: ApiError[] = []): ApiClientError<{ errors: ApiError[] }> {
  return Object.assign(Object.create(ApiClientError.prototype), {
    ok: false,
    status,
    url: connection.url,
    headers: new Headers(),
    details: { errors },
  })
}

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

describe('parseLanguageRows', () => {
  test('accepts well-formed rows', () => {
    const rows = [
      { id: 'a', locale: { code: 'de-DE' } },
      { id: 'b', locale: null },
    ]
    expect(parseLanguageRows(rows)).toEqual(rows)
  })

  test('accepts an empty array', () => {
    expect(parseLanguageRows([])).toEqual([])
  })

  test('rejects a malformed response shape', () => {
    expect(() => parseLanguageRows({ not: 'an array' })).toThrow(
      'Shopware returned an unexpected response shape for languages.',
    )
    expect(() => parseLanguageRows([{ id: 42 }])).toThrow(
      'Shopware returned an unexpected response shape for languages.',
    )
  })
})

describe('toConnectionError', () => {
  test('400 surfaces the validation detail, not an auth message', () => {
    const error = apiError(400, [
      { detail: 'This value should not be blank.', source: { pointer: '/0/0/price' } },
    ])
    const message = toConnectionError(connection, error).message
    expect(message).toBe('Shopware rejected the data — price: This value should not be blank.')
    expect(message).not.toContain('Authentication failed')
  })

  test('400 with no error detail falls back to a generic rejection', () => {
    expect(toConnectionError(connection, apiError(400)).message).toBe(
      `Shopware rejected the request (HTTP 400) from ${connection.url}.`,
    )
  })

  test('401 maps to an authentication message', () => {
    expect(toConnectionError(connection, apiError(401)).message).toBe(
      'Authentication failed — check the client ID and client secret of your integration.',
    )
  })

  test('403 lists the missing privileges', () => {
    const error = apiError(403, [
      {
        code: 'FRAMEWORK__MISSING_PRIVILEGE_ERROR',
        detail: JSON.stringify({ missingPrivileges: ['product:create'] }),
      },
    ])
    expect(toConnectionError(connection, error).message).toContain('product:create')
  })

  test('404 points at the shop URL', () => {
    expect(toConnectionError(connection, apiError(404)).message).toContain(connection.url)
  })

  test('a timeout (anywhere in the cause chain) maps to a timeout message', () => {
    const timeout = Object.assign(new Error('timed out'), { name: 'TimeoutError' })
    const wrapped = new Error('request failed', { cause: timeout })
    const message = toConnectionError(connection, wrapped).message
    expect(message).toContain('did not respond')
    expect(message).toContain(connection.url)
  })

  test('5xx maps to a shop-is-down message', () => {
    expect(toConnectionError(connection, apiError(503)).message).toBe(
      `${connection.url} is not responding (HTTP 503) — the shop may be down or in maintenance.`,
    )
  })

  test('an unexpected non-5xx status falls back to a generic message', () => {
    expect(toConnectionError(connection, apiError(418)).message).toBe(
      `Shopware returned an unexpected response (HTTP 418) from ${connection.url}.`,
    )
  })

  test('403 with malformed privilege JSON falls back to the generic permission message', () => {
    const error = apiError(403, [
      { code: 'FRAMEWORK__MISSING_PRIVILEGE_ERROR', detail: 'not-json{' },
    ])
    expect(toConnectionError(connection, error).message).toBe(
      'The integration is missing permissions — grant its role admin API access in Settings → System → Integrations.',
    )
  })

  test('non-API errors map to a reachability message', () => {
    expect(toConnectionError(connection, new Error('boom')).message).toBe(
      `Could not reach ${connection.url} — check the URL and your network connection.`,
    )
  })
})

describe('validateConnection', () => {
  test('resolves when the version endpoint succeeds', async () => {
    nextInvoke = async (action) => {
      expect(action).toContain('/_info/version')
      return { data: {} }
    }
    await expect(validateConnection(connection)).resolves.toBeUndefined()
  })

  test('maps a failed request to ShopwareConnectionError', async () => {
    nextInvoke = async () => {
      throw apiError(401)
    }
    await expect(validateConnection(connection)).rejects.toBeInstanceOf(ShopwareConnectionError)
  })
})

describe('fetchShopInfo', () => {
  test('parses the language search into shop info', async () => {
    nextInvoke = async (action) => {
      expect(action).toContain('/search/language')
      return { data: { data: [{ id: 'a', locale: { code: 'de-DE' } }] } }
    }
    expect(await fetchShopInfo(connection)).toEqual({
      locales: ['de-DE'],
      defaultLocale: 'de-DE',
    })
  })

  test('maps a failed request to ShopwareConnectionError', async () => {
    nextInvoke = async () => {
      throw apiError(403)
    }
    await expect(fetchShopInfo(connection)).rejects.toBeInstanceOf(ShopwareConnectionError)
  })
})

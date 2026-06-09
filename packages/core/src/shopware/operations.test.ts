import { describe, expect, mock, test } from 'bun:test'
import { ApiClientError, type ApiError } from '@shopware/api-client'
import type { ShopwareClient } from './client'
import { ShopwareConnectionError } from './errors'
import type { ShopwareConnection } from './types'

let nextInvoke: (action: string, args?: unknown) => Promise<unknown> = async () => ({ data: {} })

mock.module('./client', () => ({
  REQUEST_TIMEOUT_MS: 120_000,
  createShopwareClient: (): ShopwareClient =>
    ({ invoke: (action: string, args?: unknown) => nextInvoke(action, args) }) as ShopwareClient,
}))

const { toConnectionError, validateConnection } = await import('./operations')

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

describe('toConnectionError', () => {
  test('400 surfaces the validation detail, not an auth message', () => {
    const error = apiError(400, [
      { detail: 'This value should not be blank.', source: { pointer: '/0/0/price' } },
    ])
    const message = toConnectionError(connection, error).message
    expect(message).toBe('Shopware rejected the data:\n  - price: This value should not be blank.')
    expect(message).not.toContain('Authentication failed')
  })

  test('400 bullets distinct validation errors and shortens nested field pointers', () => {
    const error = apiError(400, [
      { detail: 'This value should not be blank.', source: { pointer: '/0/stateId' } },
      { detail: 'This value should not be blank.', source: { pointer: '/0/deliveries/0/stateId' } },
      {
        detail: 'This value should not be blank.',
        source: { pointer: '/0/transactions/0/stateId' },
      },
    ])
    expect(toConnectionError(connection, error).message).toBe(
      'Shopware rejected the data:\n  - stateId: This value should not be blank.',
    )
  })

  test('400 caps the bullet list and notes how many more', () => {
    const errors: ApiError[] = Array.from({ length: 8 }, (_, i) => ({
      detail: 'Invalid.',
      source: { pointer: `/0/field${i}` },
    }))
    const message = toConnectionError(connection, apiError(400, errors)).message
    expect(message).toContain('  - field0: Invalid.')
    expect(message).toContain('…and 3 more')
    expect(message).not.toContain('field5')
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

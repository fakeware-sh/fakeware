import { afterEach, describe, expect, mock, test } from 'bun:test'
import { ApiClientError, type ApiError } from '@shopware/api-client'
import type { ShopwareClient } from './client'
import { ShopwareConnectionError } from './errors'
import type { ShopwareConnection } from './types'

const connection: ShopwareConnection = {
  url: 'https://shop.test',
  clientId: 'i',
  clientSecret: 's',
}

const RESPONSES: Record<string, unknown> = {
  '/search/currency': {
    data: [
      { id: 'cur-eur', name: 'Euro', isoCode: 'EUR', isSystemDefault: true },
      { id: 'cur-usd', name: 'US Dollar', isoCode: 'USD', isSystemDefault: false },
    ],
  },
  '/search/language': {
    data: [
      { id: 'lang-en', name: 'English', locale: { code: 'en-GB' } },
      { id: 'lang-de', name: 'Deutsch', locale: { code: 'de-DE' } },
      { id: 'lang-broken', name: 'Broken', locale: null },
    ],
  },
  '/search/sales-channel': {
    data: [
      {
        id: 'sc-inactive',
        name: 'Headless',
        typeId: 'type-api',
        currencyId: 'cur-usd',
        languageId: 'lang-de',
        active: false,
      },
      {
        id: 'sc-store',
        name: 'Storefront',
        typeId: 'type-store',
        currencyId: 'cur-eur',
        languageId: 'lang-en',
        active: true,
      },
    ],
  },
  '/search/country': {
    data: [
      { id: 'country-de', name: 'Germany', iso: 'DE', iso3: 'DEU' },
      { id: 'country-noiso', name: 'Nowhere', iso: null },
    ],
  },
  '/search/salutation': {
    data: [{ id: 'sal-mr', salutationKey: 'mr', displayName: 'Mr.' }],
  },
  '/search/state-machine-state': {
    data: [
      {
        id: 'os-open',
        name: 'Open',
        technicalName: 'open',
        stateMachine: { technicalName: 'order.state' },
      },
      { id: 'orphan', name: 'Orphan', technicalName: 'open', stateMachine: null },
    ],
  },
  '/search/tax': { data: [{ id: 'tax-19', name: 'Standard', taxRate: 19 }] },
  '/search/payment-method': {
    data: [
      { id: 'pm-invoice', name: 'Invoice', technicalName: 'fakeware_invoice' },
      { id: 'pm-legacy', name: 'Legacy', technicalName: null },
    ],
  },
  '/search/shipping-method': {
    data: [{ id: 'sm-standard', name: 'Standard', technicalName: 'fakeware_standard' }],
  },
}

const defaultRespondTo = async (action: string, _params?: unknown): Promise<unknown> => {
  if (action.includes('/_info/version')) return { version: '6.0.0' }
  const key = Object.keys(RESPONSES).find((k) => action.includes(k))
  if (!key) throw new Error(`unexpected action: ${action}`)
  return RESPONSES[key]
}

let respondTo: (action: string, params?: unknown) => Promise<unknown> = defaultRespondTo

mock.module('./client', () => ({
  REQUEST_TIMEOUT_MS: 120_000,
  createShopwareClient: (): ShopwareClient =>
    ({
      invoke: (action: string, params?: unknown) => respondTo(action, params),
    }) as unknown as ShopwareClient,
  withRetry: <T>(task: () => Promise<T>): Promise<T> => task(),
}))

const { fetchShopContext } = await import('./fetch-shop-context')
const { fakeShopContext } = await import('./shop-context.fixture')

afterEach(() => {
  respondTo = defaultRespondTo
})

function apiError(status: number, errors: ApiError[] = []): ApiClientError<{ errors: ApiError[] }> {
  return Object.assign(Object.create(ApiClientError.prototype), {
    ok: false,
    status,
    url: connection.url,
    headers: new Headers(),
    details: { errors },
  })
}

describe('fetchShopContext', () => {
  test('parses every entity and indexes them for lookup', async () => {
    const ctx = await fetchShopContext(connection)
    expect(ctx.index.currencyByIso.get('EUR')?.id).toBe('cur-eur')
    expect(ctx.index.languageByLocale.get('de-DE')?.id).toBe('lang-de')
    expect(ctx.index.countryByIso.get('DE')?.id).toBe('country-de')
    expect(ctx.index.salutationByKey.get('mr')?.id).toBe('sal-mr')
    expect(ctx.index.taxByRate.get(19)?.id).toBe('tax-19')
    expect(ctx.index.paymentMethodByTechnicalName.get('fakeware_invoice')?.id).toBe('pm-invoice')
    expect(ctx.index.stateByMachineState.get('order.state::open')?.id).toBe('os-open')
  })

  test('drops rows the shop returned without the fields we key on', async () => {
    const ctx = await fetchShopContext(connection)
    expect(ctx.languages.map((l) => l.id)).not.toContain('lang-broken')
    expect(ctx.countries.map((c) => c.id)).not.toContain('country-noiso')
    expect(ctx.paymentMethods.map((p) => p.id)).not.toContain('pm-legacy')
    expect(ctx.stateMachineStates.map((s) => s.id)).not.toContain('orphan')
  })

  test('defaults to the active sales channel and its language, and the system currency', async () => {
    const ctx = await fetchShopContext(connection)
    expect(ctx.index.salesChannelDefault.id).toBe('sc-store')
    expect(ctx.index.languageDefault.id).toBe('lang-en')
    expect(ctx.index.currencyDefault.id).toBe('cur-eur')
  })

  test('marks only the default language as the system language', async () => {
    const ctx = await fetchShopContext(connection)
    expect(ctx.languages.find((l) => l.id === 'lang-en')?.isSystem).toBe(true)
    expect(ctx.languages.find((l) => l.id === 'lang-de')?.isSystem).toBe(false)
  })

  test('accumulates state machine states across multiple pages', async () => {
    const pages: Record<number, unknown[]> = {
      1: [
        {
          id: 'os-open',
          name: 'Open',
          technicalName: 'open',
          stateMachine: { technicalName: 'order.state' },
        },
      ],
      2: [
        {
          id: 'ro-requested',
          name: 'Requested',
          technicalName: 'requested',
          stateMachine: { technicalName: 'pickware_erp_return_order.state' },
        },
      ],
    }
    respondTo = (action, params) => {
      if (action.includes('/search/state-machine-state')) {
        const page = (params as { body?: { page?: number } } | undefined)?.body?.page ?? 1
        return Promise.resolve({ data: pages[page] ?? [], total: 2 })
      }
      return defaultRespondTo(action)
    }
    const ctx = await fetchShopContext(connection)
    expect(ctx.index.stateByMachineState.get('order.state::open')?.id).toBe('os-open')
    expect(
      ctx.index.stateByMachineState.get('pickware_erp_return_order.state::requested')?.id,
    ).toBe('ro-requested')
  })

  test('an unexpected response shape throws ShopwareConnectionError', async () => {
    respondTo = (action) =>
      action.includes('/search/tax')
        ? Promise.resolve({ data: [{ id: 'x', name: 'No rate' }] })
        : defaultRespondTo(action)
    await expect(fetchShopContext(connection)).rejects.toBeInstanceOf(ShopwareConnectionError)
  })

  test('a per-entity HTTP error is mapped through toConnectionError', async () => {
    respondTo = (action) => {
      if (action.includes('/search/payment-method')) throw apiError(403)
      return defaultRespondTo(action)
    }
    await expect(fetchShopContext(connection)).rejects.toBeInstanceOf(ShopwareConnectionError)
  })

  test('extra fetchers contribute to the extensions bag', async () => {
    const ctx = await fetchShopContext(connection, [
      {
        plugin: 'warehouses',
        fetcher: {
          entity: 'warehouses',
          fetch: async () => ({ data: [{ id: 'wh-1' }] }),
          merge: (data, raw) => {
            data.extensions.warehouses = (raw as { data: unknown[] }).data
          },
        },
      },
    ])
    expect(ctx.extensions.warehouses).toEqual([{ id: 'wh-1' }])
  })

  test('a failing plugin fetcher is attributed to its plugin and entity', async () => {
    const run = fetchShopContext(connection, [
      {
        plugin: 'warehouses',
        fetcher: {
          entity: 'depots',
          fetch: async () => {
            throw new Error('boom')
          },
          merge: () => {},
        },
      },
    ])
    await expect(run).rejects.toBeInstanceOf(ShopwareConnectionError)
    await expect(run).rejects.toThrow(/Plugin "warehouses" fetcher "depots" failed/)
  })
})

describe('default resolution', () => {
  test('falls back to the channel currency when no currency is the system default', () => {
    const ctx = fakeShopContext({
      currencies: [{ id: 'cur-usd', name: 'USD', isoCode: 'USD', isSystemDefault: false }],
      languages: [{ id: 'lang-en', name: 'English', locale: 'en-GB', isSystem: false }],
      salesChannels: [
        {
          id: 'sc',
          name: 'Store',
          typeId: 't',
          currencyId: 'cur-usd',
          languageId: 'lang-en',
          countryId: null,
          active: true,
        },
      ],
    })
    expect(ctx.index.currencyDefault.id).toBe('cur-usd')
  })

  test('throws when the shop returned no sales channels', () => {
    expect(() => fakeShopContext({ salesChannels: [] })).toThrow(ShopwareConnectionError)
  })
})

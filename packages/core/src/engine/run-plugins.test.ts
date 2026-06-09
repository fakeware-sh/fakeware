import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ConfigError, type LoadedConfig } from '../config'
import { createInMemorySink } from '../domain'
import type { FakewarePlugin } from '../plugin'
import type { ShopwareClient } from '../shopware/client'
import { fakeShopContext } from '../shopware/shop-context.fixture'

const RESPONSES: Record<string, unknown> = {
  '/search/currency': {
    data: [{ id: 'cur-eur', name: 'Euro', isoCode: 'EUR', isSystemDefault: true }],
  },
  '/search/language': { data: [{ id: 'lang-en', name: 'English', locale: { code: 'en-GB' } }] },
  '/search/sales-channel': {
    data: [
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
  '/search/country': { data: [] },
  '/search/salutation': { data: [] },
  '/search/state-machine-state': { data: [] },
  '/search/tax': { data: [] },
  '/search/payment-method': { data: [] },
  '/search/shipping-method': { data: [] },
}

const respondTo = async (action: string): Promise<unknown> => {
  const key = Object.keys(RESPONSES).find((k) => action.includes(k))
  if (!key) throw new Error(`unexpected action: ${action}`)
  return RESPONSES[key]
}

mock.module('../shopware/client', () => ({
  REQUEST_TIMEOUT_MS: 120_000,
  createShopwareClient: (): ShopwareClient =>
    ({ invoke: (action: string) => respondTo(action) }) as unknown as ShopwareClient,
}))

const { runUp } = await import('./run')

function loadedFor(dir: string, plugins: FakewarePlugin[]): LoadedConfig {
  return {
    config: {
      shopware: { url: 'https://shop.test', clientId: 'i', clientSecret: 's' },
      transaction: { onError: 'rollback', atomic: false },
    },
    connection: { url: 'https://shop.test', clientId: 'i', clientSecret: 's' },
    configPath: join(dir, 'fakeware.config.ts'),
    projectRoot: dir,
    plugins,
  }
}

describe('runUp with plugins', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'fakeware-plugins-'))
    await mkdir(join(dir, 'data'), { recursive: true })
  })
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  test('forwards plugin fetchers to fetchShopContext', async () => {
    let seen: unknown
    const plugin: FakewarePlugin = {
      name: 'warehouses',
      fetchers: [
        {
          entity: 'warehouses',
          fetch: async () => ({ data: [{ id: 'wh-1' }] }),
          merge: (data, raw) => {
            data.extensions.warehouses = (raw as { data: unknown[] }).data
          },
        },
      ],
      setup: ({ shopContext }) => {
        seen = shopContext.extensions.warehouses
      },
    }
    await runUp({ loaded: loadedFor(dir, [plugin]), sink: createInMemorySink() })
    expect(seen).toEqual([{ id: 'wh-1' }])
  })

  test('runs setup hooks in array order after the context is built', async () => {
    const order: string[] = []
    const plugin = (name: string): FakewarePlugin => ({
      name,
      setup: ({ shopContext }) => {
        expect(shopContext.index.currencyDefault.isoCode).toBe('EUR')
        order.push(name)
      },
    })
    await runUp({
      loaded: loadedFor(dir, [plugin('a'), plugin('b'), plugin('c')]),
      sink: createInMemorySink(),
      shopContext: fakeShopContext(),
    })
    expect(order).toEqual(['a', 'b', 'c'])
  })

  test('a preset shopContext skips the fetch yet still runs setup', async () => {
    let ran = false
    const plugin: FakewarePlugin = {
      name: 'boom',
      fetchers: [
        {
          entity: 'boom',
          fetch: async () => {
            throw new Error('fetch must not run when a context is preset')
          },
          merge: () => {},
        },
      ],
      setup: () => {
        ran = true
      },
    }
    await runUp({
      loaded: loadedFor(dir, [plugin]),
      sink: createInMemorySink(),
      shopContext: fakeShopContext(),
    })
    expect(ran).toBe(true)
  })

  test('a throwing setup aborts runUp with the plugin name', async () => {
    const plugin: FakewarePlugin = {
      name: 'boom',
      setup: () => {
        throw new Error('kaboom')
      },
    }
    const run = runUp({
      loaded: loadedFor(dir, [plugin]),
      sink: createInMemorySink(),
      shopContext: fakeShopContext(),
    })
    await expect(run).rejects.toBeInstanceOf(ConfigError)
    await expect(run).rejects.toThrow(/Plugin "boom" setup failed/)
  })
})

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { LoadedConfig } from '../config'
import { createInMemorySink } from '../domain'
import type { FakewarePlugin } from '../plugin'
import { PluginError } from '../plugin'
import type { ShopwareClient } from '../shopware'
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
  if (action.includes('/_info/version')) return { version: '6.0.0' }
  const key = Object.keys(RESPONSES).find((k) => action.includes(k))
  if (!key) throw new Error(`unexpected action: ${action}`)
  return RESPONSES[key]
}

mock.module('../shopware/client', () => ({
  REQUEST_TIMEOUT_MS: 120_000,
  createShopwareClient: (): ShopwareClient =>
    ({ invoke: (action: string) => respondTo(action) }) as unknown as ShopwareClient,
}))

const { runUp, runDown } = await import('./run')

function loadedFor(dir: string, plugins: FakewarePlugin[]): LoadedConfig {
  return {
    config: { shopware: { url: 'https://shop.test', clientId: 'i', clientSecret: 's' } },
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
      hooks: {
        contextReady: ({ shopContext }) => {
          seen = shopContext.extensions.warehouses
        },
      },
    }
    await runUp({ loaded: loadedFor(dir, [plugin]), sink: createInMemorySink() })
    expect(seen).toEqual([{ id: 'wh-1' }])
  })

  test('runs lifecycle hooks in order across the up run', async () => {
    const order: string[] = []
    const plugin = (name: string): FakewarePlugin => ({
      name,
      hooks: {
        configResolved: () => {
          order.push(`${name}:configResolved`)
        },
        contextReady: ({ shopContext }) => {
          expect(shopContext.index.currencyDefault.isoCode).toBe('EUR')
          order.push(`${name}:contextReady`)
        },
        beforeApply: ({ dryRun }) => {
          order.push(`${name}:beforeApply:${dryRun}`)
        },
        afterApply: ({ result }) => {
          order.push(`${name}:afterApply:${result.committed}`)
        },
      },
    })
    await runUp({
      loaded: loadedFor(dir, [plugin('a'), plugin('b')]),
      sink: createInMemorySink(),
      shopContext: fakeShopContext(),
    })
    expect(order).toEqual([
      'a:configResolved',
      'b:configResolved',
      'a:contextReady',
      'b:contextReady',
      'a:beforeApply:false',
      'b:beforeApply:false',
      'a:afterApply:0',
      'b:afterApply:0',
    ])
  })

  test('a preset shopContext skips the fetch yet still runs hooks', async () => {
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
      hooks: {
        contextReady: () => {
          ran = true
        },
      },
    }
    await runUp({
      loaded: loadedFor(dir, [plugin]),
      sink: createInMemorySink(),
      shopContext: fakeShopContext(),
    })
    expect(ran).toBe(true)
  })

  test('a throwing hook aborts runUp with a PluginError naming the phase', async () => {
    const plugin: FakewarePlugin = {
      name: 'boom',
      hooks: {
        contextReady: () => {
          throw new Error('kaboom')
        },
      },
    }
    const run = runUp({
      loaded: loadedFor(dir, [plugin]),
      sink: createInMemorySink(),
      shopContext: fakeShopContext(),
    })
    await expect(run).rejects.toBeInstanceOf(PluginError)
    await expect(run).rejects.toMatchObject({ plugin: 'boom', phase: 'contextReady' })
  })

  test('a throwing hook dispatches onError before rethrowing', async () => {
    let errorPhase: string | undefined
    const plugin: FakewarePlugin = {
      name: 'boom',
      hooks: {
        beforeApply: () => {
          throw new Error('kaboom')
        },
        onError: ({ phase, error }) => {
          errorPhase = phase
          expect((error as Error).message).toBe('kaboom')
        },
      },
    }
    const run = runUp({
      loaded: loadedFor(dir, [plugin]),
      sink: createInMemorySink(),
      shopContext: fakeShopContext(),
    })
    await expect(run).rejects.toBeInstanceOf(PluginError)
    expect(errorPhase).toBe('beforeApply')
  })
})

describe('runDown with plugins', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'fakeware-plugins-down-'))
    await mkdir(join(dir, 'data'), { recursive: true })
  })
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  test('runs configResolved even when there is no manifest', async () => {
    const order: string[] = []
    const plugin: FakewarePlugin = {
      name: 'a',
      hooks: {
        configResolved: () => {
          order.push('configResolved')
        },
        beforeRevert: () => {
          order.push('beforeRevert')
        },
      },
    }
    const result = await runDown({
      loaded: loadedFor(dir, [plugin]),
      sink: createInMemorySink(),
      shopContext: fakeShopContext(),
    })
    expect(result.reverted).toBe(false)
    expect(order).toEqual(['configResolved'])
  })

  test('runs the revert lifecycle when a manifest exists', async () => {
    const order: string[] = []
    const plugin: FakewarePlugin = {
      name: 'a',
      hooks: {
        beforeRevert: ({ dryRun }) => {
          order.push(`beforeRevert:${dryRun}`)
        },
        afterRevert: ({ result }) => {
          order.push(`afterRevert:${result.reverted}`)
        },
      },
    }
    const sink = createInMemorySink()
    const loaded = loadedFor(dir, [plugin])
    const TAX = `import { define } from '${join(import.meta.dir, '..', 'index.ts')}'\ndefine('tax', [{ $key: 'standard', taxRate: 19 }])\n`
    await Bun.write(join(dir, 'data', 'tax.ts'), TAX)
    await runUp({ loaded, sink, shopContext: fakeShopContext() })

    await runDown({ loaded, sink, shopContext: fakeShopContext() })
    expect(order).toEqual(['beforeRevert:false', 'afterRevert:true'])
  })
})

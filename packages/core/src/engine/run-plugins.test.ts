import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { LoadedConfig } from '../config'
import type { CheckOutcome, FakewarePlugin, LogEntry } from '../plugin'
import { PluginCheckError, PluginError } from '../plugin'
import type { ShopwareClient } from '../shopware'
import { ShopwareApiError, ShopwareConnectionError } from '../shopware'
import { createInMemorySink, fakeShopContext } from '../testing'
import { ApplyStopped } from './errors'

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
  '/search/media-folder': { data: [] },
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

const { runDown } = await import('./run-down')
const { runUp } = await import('./run-up')

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

  test('plugin debug logs reach the reporter only when debug is enabled', async () => {
    const plugin = (): FakewarePlugin => ({
      name: 'chatty',
      hooks: {
        contextReady: ({ logger }) => {
          logger.debug('noisy')
          logger.info('loud')
        },
      },
    })

    const quiet: LogEntry[] = []
    await runUp({
      loaded: loadedFor(dir, [plugin()]),
      sink: createInMemorySink(),
      shopContext: fakeShopContext(),
      reporter: { log: (entry) => quiet.push(entry) },
    })
    expect(quiet.map((e) => e.message)).toEqual(['loud'])

    const verbose: LogEntry[] = []
    await runUp({
      loaded: loadedFor(dir, [plugin()]),
      sink: createInMemorySink(),
      shopContext: fakeShopContext(),
      debug: true,
      reporter: { log: (entry) => verbose.push(entry) },
    })
    expect(verbose.map((e) => e.message)).toEqual(['noisy', 'loud'])
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

  test('a sink failure dispatches onError with the normalized api error', async () => {
    let seenPhase: string | undefined
    let seenError: unknown
    const plugin: FakewarePlugin = {
      name: 'observer',
      hooks: {
        onError: ({ phase, error }) => {
          seenPhase = phase
          seenError = error
        },
      },
    }
    const TAX = `import { define } from '${join(import.meta.dir, '..', 'index.ts')}'\ndefine('tax', [{ $key: 'standard', taxRate: 19 }])\n`
    await Bun.write(join(dir, 'data', 'tax.ts'), TAX)
    const sink = {
      ...createInMemorySink(),
      write: async () => {
        throw new Error('disk on fire')
      },
    }
    const run = runUp({
      loaded: loadedFor(dir, [plugin]),
      sink,
      shopContext: fakeShopContext(),
    })
    await expect(run).rejects.toBeInstanceOf(ApplyStopped)
    expect(seenPhase).toBe('apply')
    expect(seenError).toBeInstanceOf(ShopwareApiError)
    expect((seenError as ShopwareApiError).entity).toBe('tax')
  })

  test('a failing shop-context fetch dispatches onError before rethrowing', async () => {
    let seenPhase: string | undefined
    const plugin: FakewarePlugin = {
      name: 'boom',
      fetchers: [
        {
          entity: 'depots',
          fetch: async () => {
            throw new Error('unreachable')
          },
          merge: () => {},
        },
      ],
      hooks: {
        onError: ({ phase }) => {
          seenPhase = phase
        },
      },
    }
    const run = runUp({ loaded: loadedFor(dir, [plugin]), sink: createInMemorySink() })
    await expect(run).rejects.toBeInstanceOf(ShopwareConnectionError)
    expect(seenPhase).toBe('apply')
  })
})

function checkPlugin(outcome: CheckOutcome | undefined, fetched?: () => void): FakewarePlugin {
  return {
    name: 'gated',
    checks: [{ name: 'compatible', needsShop: true, run: () => outcome }],
    fetchers: [
      {
        entity: 'gated rows',
        fetch: async () => {
          fetched?.()
          return { data: [] }
        },
        merge: () => {},
      },
    ],
  }
}

describe('plugin checks gate the run', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'fakeware-checks-'))
    await mkdir(join(dir, 'data'), { recursive: true })
  })
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  test('a failing check aborts up before any fetcher runs', async () => {
    let fetched = false
    const plugin = checkPlugin({ level: 'error', message: 'not installed' }, () => {
      fetched = true
    })
    const run = runUp({ loaded: loadedFor(dir, [plugin]), sink: createInMemorySink() })
    await expect(run).rejects.toBeInstanceOf(PluginCheckError)
    expect(fetched).toBe(false)
  })

  test('a failing check does not reach onError, since nothing was applied', async () => {
    let seen: string | null = null
    const plugin: FakewarePlugin = {
      ...checkPlugin({ level: 'error', message: 'not installed' }),
      hooks: {
        onError: ({ phase }) => {
          seen = phase
        },
      },
    }
    const run = runUp({ loaded: loadedFor(dir, [plugin]), sink: createInMemorySink() })
    await expect(run).rejects.toBeInstanceOf(PluginCheckError)
    expect(seen).toBeNull()
  })

  test('a warning is logged and the run continues', async () => {
    const entries: LogEntry[] = []
    let fetched = false
    const plugin = checkPlugin({ level: 'warn', message: 'old version', hint: 'update it' }, () => {
      fetched = true
    })
    await runUp({
      loaded: loadedFor(dir, [plugin]),
      sink: createInMemorySink(),
      reporter: { log: (entry) => entries.push(entry) },
    })
    expect(fetched).toBe(true)
    expect(entries).toEqual([{ plugin: 'gated', level: 'warn', message: 'old version update it' }])
  })

  test('a passing check lets the run proceed', async () => {
    let fetched = false
    const plugin = checkPlugin(undefined, () => {
      fetched = true
    })
    await runUp({ loaded: loadedFor(dir, [plugin]), sink: createInMemorySink() })
    expect(fetched).toBe(true)
  })

  test('checks are skipped when a shop context is supplied', async () => {
    let ran = false
    const plugin: FakewarePlugin = {
      name: 'gated',
      checks: [
        {
          name: 'compatible',
          needsShop: true,
          run: () => {
            ran = true
            return { level: 'error' as const, message: 'must not run' }
          },
        },
      ],
    }
    await runUp({
      loaded: loadedFor(dir, [plugin]),
      sink: createInMemorySink(),
      shopContext: fakeShopContext(),
    })
    expect(ran).toBe(false)
  })

  test('a failing check aborts down once a manifest exists', async () => {
    const sink = createInMemorySink()
    const passing = checkPlugin(undefined)
    const loaded = loadedFor(dir, [passing])
    const TAX = `import { define } from '${join(import.meta.dir, '..', 'index.ts')}'\ndefine('tax', [{ $key: 'standard', taxRate: 19 }])\n`
    await Bun.write(join(dir, 'data', 'tax.ts'), TAX)
    await runUp({ loaded, sink })

    const failing = checkPlugin({ level: 'error', message: 'not installed' })
    const run = runDown({ loaded: loadedFor(dir, [failing]), sink })
    await expect(run).rejects.toBeInstanceOf(PluginCheckError)
  })

  test('down without a manifest never runs checks', async () => {
    let ran = false
    const plugin: FakewarePlugin = {
      name: 'gated',
      checks: [
        {
          name: 'compatible',
          needsShop: true,
          run: () => {
            ran = true
          },
        },
      ],
    }
    const result = await runDown({
      loaded: loadedFor(dir, [plugin]),
      sink: createInMemorySink(),
    })
    expect(result.reverted).toBe(false)
    expect(ran).toBe(false)
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

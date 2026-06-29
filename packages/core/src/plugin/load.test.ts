import { describe, expect, test } from 'bun:test'
import { ConfigError } from '../config'
import type { ShopContextFetcher } from '../shopware'
import type { FakewarePlugin } from './define'
import { collectFetchers, loadPlugins } from './load'

const fetcher = (entity: string): ShopContextFetcher => ({
  entity,
  fetch: async () => ({}),
  merge: () => {},
})

describe('loadPlugins', () => {
  test('returns an empty array when given nothing', () => {
    expect(loadPlugins()).toEqual([])
  })

  test('preserves array order', () => {
    const plugins: FakewarePlugin[] = [{ name: 'a' }, { name: 'b' }, { name: 'c' }]
    expect(loadPlugins(plugins).map((p) => p.name)).toEqual(['a', 'b', 'c'])
  })

  test('preserves fetcher and hook identity', () => {
    const f = fetcher('warehouses')
    const contextReady = async () => {}
    const [plugin] = loadPlugins([{ name: 'a', fetchers: [f], hooks: { contextReady } }])
    expect(plugin?.fetchers?.[0]).toBe(f)
    expect(plugin?.hooks?.contextReady).toBe(contextReady)
  })

  test('throws ConfigError when a plugin is missing a string name', () => {
    expect(() => loadPlugins([{} as FakewarePlugin])).toThrow(ConfigError)
    expect(() => loadPlugins([{ name: 1 } as unknown as FakewarePlugin])).toThrow(/plugins\[0\]/)
  })

  test('throws ConfigError on an empty plugin name', () => {
    expect(() => loadPlugins([{ name: '' }])).toThrow(ConfigError)
  })

  test('throws ConfigError when fetchers is not an array', () => {
    expect(() => loadPlugins([{ name: 'a', fetchers: {} } as unknown as FakewarePlugin])).toThrow(
      ConfigError,
    )
  })

  test('throws ConfigError when hooks is not an object', () => {
    expect(() => loadPlugins([{ name: 'a', hooks: 'go' } as unknown as FakewarePlugin])).toThrow(
      /"hooks" must be an object/,
    )
  })

  test('throws ConfigError when a hook is not a function', () => {
    expect(() =>
      loadPlugins([{ name: 'a', hooks: { contextReady: 'go' } } as unknown as FakewarePlugin]),
    ).toThrow(/hook "contextReady" must be a function/)
  })

  test('rejects the removed setup field with a migration hint', () => {
    expect(() =>
      loadPlugins([{ name: 'a', setup: () => {} } as unknown as FakewarePlugin]),
    ).toThrow(/"setup" was removed\. Use "hooks\.contextReady"/)
  })

  test('throws ConfigError on a duplicate plugin name', () => {
    expect(() => loadPlugins([{ name: 'a' }, { name: 'a' }])).toThrow(/duplicate plugin name "a"/)
  })
})

describe('collectFetchers', () => {
  test('flattens fetchers tagged with their owning plugin name', () => {
    const wh = fetcher('warehouses')
    const inv = fetcher('inventory')
    const owned = collectFetchers([
      { name: 'a', fetchers: [wh] },
      { name: 'b' },
      { name: 'c', fetchers: [inv] },
    ])
    expect(owned).toEqual([
      { plugin: 'a', fetcher: wh },
      { plugin: 'c', fetcher: inv },
    ])
  })
})

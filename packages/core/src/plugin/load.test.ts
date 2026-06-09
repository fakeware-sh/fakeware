import { describe, expect, test } from 'bun:test'
import { ConfigError } from '../config/errors'
import type { ShopContextFetcher } from '../shopware'
import type { FakewarePlugin } from './define'
import { loadPlugins } from './load'

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

  test('preserves fetcher and setup identity', () => {
    const f = fetcher('warehouses')
    const setup = async () => {}
    const [plugin] = loadPlugins([{ name: 'a', fetchers: [f], setup }])
    expect(plugin?.fetchers?.[0]).toBe(f)
    expect(plugin?.setup).toBe(setup)
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

  test('throws ConfigError when setup is not a function', () => {
    expect(() => loadPlugins([{ name: 'a', setup: 'go' } as unknown as FakewarePlugin])).toThrow(
      /"setup" must be a function/,
    )
  })

  test('throws ConfigError on a duplicate plugin name', () => {
    expect(() => loadPlugins([{ name: 'a' }, { name: 'a' }])).toThrow(/duplicate plugin name "a"/)
  })
})

import { describe, expect, test } from 'bun:test'

const PUBLIC_API = [
  'ApplyStopped',
  'GraphError',
  'LoadModuleError',
  'MEDIA_UPLOAD_KEY',
  'PluginError',
  'RefError',
  'ShopContextError',
  'ShopwareApiError',
  'ShopwareConnectionError',
  'assocIds',
  'builders',
  'consoleLogSink',
  'define',
  'definePlugin',
  'deterministicId',
  'isShopToken',
  'isShopValueToken',
  'keyed',
  'many',
  'media',
  'price',
  'readManifest',
  'ref',
  'runDown',
  'runUp',
  'shop',
  'shopToken',
  'silentLogSink',
  'validateProject',
]

describe('public API surface', () => {
  test('the root barrel exports exactly the curated set', async () => {
    const api = await import('./index')
    expect(Object.keys(api).sort()).toEqual([...PUBLIC_API].sort())
  })

  test('test doubles are not reachable from the root barrel', async () => {
    const api = (await import('./index')) as Record<string, unknown>
    expect(api.createInMemorySink).toBeUndefined()
    expect(api.fakeShopContext).toBeUndefined()
    expect(api.createTestClient).toBeUndefined()
  })
})

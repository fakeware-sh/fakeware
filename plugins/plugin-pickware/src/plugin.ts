import { definePlugin, type FakewarePlugin } from '@fakeware/core'
import { warehousesFetcher } from './fetchers'

export function pickware(): FakewarePlugin {
  return definePlugin({
    name: 'pickware',
    fetchers: [warehousesFetcher],
  })
}

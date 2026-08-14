import { definePlugin, type FakewarePlugin } from '@fakeware/core'
import { pickwareInstalledCheck } from './checks'
import { warehousesFetcher } from './fetchers'

export function pickware(): FakewarePlugin {
  return definePlugin({
    name: 'pickware',
    fetchers: [warehousesFetcher],
    checks: [pickwareInstalledCheck],
  })
}

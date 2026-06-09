import type { ShopContext, ShopContextFetcher } from '../shopware'

export interface PluginContext {
  shopContext: ShopContext
}

export interface FakewarePlugin {
  name: string
  fetchers?: ShopContextFetcher[]
  setup?(ctx: PluginContext): void | Promise<void>
}

export function definePlugin(plugin: FakewarePlugin): FakewarePlugin {
  return plugin
}

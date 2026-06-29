import { ConfigError } from '../config'
import type { ShopContextFetcher } from '../shopware'
import type { FakewarePlugin, PluginHooks } from './define'

const HOOK_NAMES: (keyof PluginHooks)[] = [
  'configResolved',
  'contextReady',
  'beforeApply',
  'afterApply',
  'beforeRevert',
  'afterRevert',
  'onError',
]

export interface OwnedFetcher {
  plugin: string
  fetcher: ShopContextFetcher
}

export function loadPlugins(plugins: FakewarePlugin[] = []): FakewarePlugin[] {
  const seen = new Set<string>()
  for (const [i, plugin] of plugins.entries()) {
    if (!plugin || typeof plugin !== 'object' || typeof plugin.name !== 'string' || !plugin.name) {
      throw new ConfigError(`plugins[${i}] is not a valid plugin (missing "name").`)
    }
    if (plugin.fetchers !== undefined && !Array.isArray(plugin.fetchers)) {
      throw new ConfigError(`plugins[${i}] "${plugin.name}": "fetchers" must be an array.`)
    }
    if (plugin.hooks !== undefined) {
      if (typeof plugin.hooks !== 'object' || plugin.hooks === null) {
        throw new ConfigError(`plugins[${i}] "${plugin.name}": "hooks" must be an object.`)
      }
      for (const hook of HOOK_NAMES) {
        const value = plugin.hooks[hook]
        if (value !== undefined && typeof value !== 'function') {
          throw new ConfigError(
            `plugins[${i}] "${plugin.name}": hook "${hook}" must be a function.`,
          )
        }
      }
    }
    if ('setup' in plugin) {
      throw new ConfigError(
        `plugins[${i}] "${plugin.name}": "setup" was removed. Use "hooks.contextReady" instead.`,
      )
    }
    if (seen.has(plugin.name)) {
      throw new ConfigError(`plugins[${i}] duplicate plugin name "${plugin.name}".`)
    }
    seen.add(plugin.name)
  }
  return plugins
}

export function collectFetchers(plugins: FakewarePlugin[]): OwnedFetcher[] {
  return plugins.flatMap((plugin) =>
    (plugin.fetchers ?? []).map((fetcher) => ({ plugin: plugin.name, fetcher })),
  )
}

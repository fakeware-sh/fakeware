import { ConfigError } from '../config/errors'
import type { FakewarePlugin } from './define'

export function loadPlugins(plugins: FakewarePlugin[] = []): FakewarePlugin[] {
  const seen = new Set<string>()
  for (const [i, plugin] of plugins.entries()) {
    if (!plugin || typeof plugin !== 'object' || typeof plugin.name !== 'string' || !plugin.name) {
      throw new ConfigError(`plugins[${i}] is not a valid plugin (missing "name").`)
    }
    if (plugin.fetchers !== undefined && !Array.isArray(plugin.fetchers)) {
      throw new ConfigError(`plugins[${i}] "${plugin.name}": "fetchers" must be an array.`)
    }
    if (plugin.setup !== undefined && typeof plugin.setup !== 'function') {
      throw new ConfigError(`plugins[${i}] "${plugin.name}": "setup" must be a function.`)
    }
    if (seen.has(plugin.name)) {
      throw new ConfigError(`plugins[${i}] duplicate plugin name "${plugin.name}".`)
    }
    seen.add(plugin.name)
  }
  return plugins
}

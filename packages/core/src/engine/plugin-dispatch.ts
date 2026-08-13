import { DEFAULT_MODE } from '../config'
import {
  type ConfigContext,
  createPluginLogger,
  type FakewarePlugin,
  type LogEntry,
  type PluginContext,
} from '../plugin'
import type { ShopContext } from '../shopware'
import type { Reporter, RunOptions } from './types'

export function reporterLogSink(reporter?: Reporter) {
  return {
    debug: false,
    write(entry: LogEntry): void {
      reporter?.log?.(entry)
    },
  }
}

export function configContextFor(opts: RunOptions, plugin: FakewarePlugin): ConfigContext {
  return {
    config: opts.loaded.config,
    connection: opts.loaded.connection,
    projectRoot: opts.loaded.projectRoot,
    mode: opts.mode ?? DEFAULT_MODE,
    logger: createPluginLogger(plugin.name, reporterLogSink(opts.reporter)),
  }
}

export function pluginContextFor(
  opts: RunOptions,
  plugin: FakewarePlugin,
  shopContext: ShopContext,
): PluginContext {
  return { ...configContextFor(opts, plugin), shopContext }
}

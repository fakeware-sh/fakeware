import { DEFAULT_MODE } from '../config'
import {
  type CheckContext,
  type CheckReport,
  type ConfigContext,
  createPluginLogger,
  type FakewarePlugin,
  type LogEntry,
  type PluginContext,
  reportFailures,
  runPluginChecks,
} from '../plugin'
import { createShopwareClient, type ShopContext, type ShopwareClient } from '../shopware'
import type { Reporter, RunOptions } from './types'

export function reporterLogSink(reporter?: Reporter, debug = false) {
  return {
    debug,
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
    logger: createPluginLogger(plugin.name, reporterLogSink(opts.reporter, opts.debug)),
  }
}

export function pluginContextFor(
  opts: RunOptions,
  plugin: FakewarePlugin,
  shopContext: ShopContext,
): PluginContext {
  return { ...configContextFor(opts, plugin), shopContext }
}

export function checkContextFor(
  opts: RunOptions,
  plugin: FakewarePlugin,
  client: ShopwareClient,
): CheckContext {
  return { ...configContextFor(opts, plugin), client }
}

export async function gateOnChecks(opts: RunOptions): Promise<ShopwareClient | undefined> {
  const plugins = opts.loaded.plugins
  if (plugins.every((plugin) => (plugin.checks ?? []).length === 0)) return opts.client

  const client = opts.client ?? createShopwareClient(opts.loaded.connection)
  const reports = await runPluginChecks(
    plugins,
    (plugin) => checkContextFor(opts, plugin, client),
    { shop: true },
  )
  warnFrom(opts, reports)
  reportFailures(reports)
  return client
}

function warnFrom(opts: RunOptions, reports: CheckReport[]): void {
  for (const report of reports) {
    if (report.level !== 'warn') continue
    const hint = report.hint ? ` ${report.hint}` : ''
    createPluginLogger(report.plugin, reporterLogSink(opts.reporter, opts.debug)).warn(
      `${report.message}${hint}`,
    )
  }
}

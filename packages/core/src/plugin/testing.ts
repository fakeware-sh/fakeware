import type { FakewareConfig } from '../config'
import type { ShopContext, ShopContextData, ShopwareConnection } from '../shopware'
import { fakeShopContext } from '../shopware/shop-context.fixture'
import type {
  ApplyContext,
  ConfigContext,
  FakewarePlugin,
  PluginContext,
  RevertContext,
} from './define'
import { createPluginLogger, type LogEntry, type LogSink } from './logger'

export interface CollectingLogSink extends LogSink {
  entries: LogEntry[]
}

export function createCollectingLogSink(debug = false): CollectingLogSink {
  const entries: LogEntry[] = []
  return {
    debug,
    entries,
    write(entry) {
      entries.push(entry)
    },
  }
}

const DEFAULT_CONFIG: FakewareConfig = {
  transaction: { onError: 'rollback', atomic: true },
}

const DEFAULT_CONNECTION: ShopwareConnection = {
  url: 'https://shop.test',
  clientId: 'test-id',
  clientSecret: 'test-secret',
}

export interface TestContextOptions {
  name?: string
  config?: FakewareConfig
  connection?: ShopwareConnection
  projectRoot?: string
  mode?: string
  shopContext?: ShopContext
  shopData?: Partial<ShopContextData>
  sink?: LogSink
}

export function createTestPluginContext(opts: TestContextOptions = {}): PluginContext {
  const sink = opts.sink ?? createCollectingLogSink()
  return {
    config: opts.config ?? DEFAULT_CONFIG,
    connection: opts.connection ?? DEFAULT_CONNECTION,
    projectRoot: opts.projectRoot ?? '/tmp/fakeware-test',
    mode: opts.mode ?? 'test',
    logger: createPluginLogger(opts.name ?? 'test-plugin', sink),
    shopContext: opts.shopContext ?? fakeShopContext(opts.shopData),
  }
}

type HookArgs = {
  configResolved: ConfigContext
  contextReady: PluginContext
  beforeApply: ApplyContext
  beforeRevert: RevertContext
}

export async function runPluginHookOnce<H extends keyof HookArgs>(
  plugin: FakewarePlugin,
  hook: H,
  ctx: HookArgs[H],
): Promise<void> {
  const fn = plugin.hooks?.[hook] as ((c: HookArgs[H]) => unknown) | undefined
  if (!fn) return
  await fn(ctx)
}

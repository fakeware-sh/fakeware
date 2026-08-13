import type {
  ConfigContext,
  ErrorContext,
  FakewarePlugin,
  PluginContext,
  PluginHooks,
  PluginPhase,
} from './define'

export class PluginError extends Error {
  readonly plugin: string
  readonly phase: PluginPhase

  constructor(plugin: string, phase: PluginPhase, options: { cause: unknown }) {
    super(`Plugin "${plugin}" failed during "${phase}".`, { cause: options.cause })
    this.name = 'PluginError'
    this.plugin = plugin
    this.phase = phase
  }
}

type LifecycleHook = Exclude<keyof PluginHooks, 'onError'>

export async function runPluginHook<C extends ConfigContext>(
  plugins: FakewarePlugin[],
  hook: LifecycleHook,
  phase: PluginPhase,
  contextFor: (plugin: FakewarePlugin) => C,
  result?: unknown,
): Promise<void> {
  for (const plugin of plugins) {
    const fn = plugin.hooks?.[hook]
    if (!fn) continue
    const ctx = result === undefined ? contextFor(plugin) : { ...contextFor(plugin), result }
    try {
      await (fn as (c: unknown) => unknown)(ctx)
    } catch (error) {
      await dispatchOnError(plugins, phase, error, contextFor)
      throw new PluginError(plugin.name, phase, { cause: error })
    }
  }
}

export async function dispatchOnError(
  plugins: FakewarePlugin[],
  phase: PluginPhase,
  error: unknown,
  contextFor: (plugin: FakewarePlugin) => ConfigContext,
): Promise<void> {
  for (const plugin of plugins) {
    const onError: PluginHooks['onError'] = plugin.hooks?.onError
    if (!onError) continue
    const base = contextFor(plugin)
    const ctx: ErrorContext = {
      ...base,
      shopContext: (base as Partial<PluginContext>).shopContext,
      error,
      phase,
    }
    try {
      await onError(ctx)
    } catch (handlerError) {
      const reason = handlerError instanceof Error ? handlerError.message : String(handlerError)
      base.logger.warn(`onError handler threw during "${phase}": ${reason}`)
    }
  }
}

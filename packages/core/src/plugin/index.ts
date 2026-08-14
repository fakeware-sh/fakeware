export type {
  CheckContext,
  CheckLevel,
  CheckOutcome,
  CheckReport,
  CheckResult,
  PluginCheck,
} from './check'
export { offlineClient } from './check'
export type {
  ApplyContext,
  ConfigContext,
  ErrorContext,
  FakewarePlugin,
  MaybePromise,
  PluginContext,
  PluginHooks,
  PluginPhase,
  RevertContext,
} from './define'
export { definePlugin } from './define'
export { collectFetchers, loadPlugins, type OwnedFetcher } from './load'
export {
  consoleLogSink,
  createPluginLogger,
  type LogEntry,
  type LogLevel,
  type LogSink,
  type PluginLogger,
  silentLogSink,
} from './logger'
export {
  countShopChecks,
  PluginCheckError,
  reportFailures,
  runPluginChecks,
} from './run-checks'
export { dispatchOnError, PluginError, runPluginHook } from './run-hooks'

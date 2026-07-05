import type { FakewareConfig } from '../config'
import type { DownResult, UpResult } from '../engine'
import type { ShopContext, ShopContextFetcher, ShopwareConnection } from '../shopware'
import type { PluginLogger } from './logger'

export type MaybePromise<T> = T | Promise<T>

export type PluginPhase =
  | 'configResolved'
  | 'contextReady'
  | 'beforeApply'
  | 'afterApply'
  | 'beforeRevert'
  | 'afterRevert'

export interface ConfigContext {
  config: FakewareConfig
  connection: ShopwareConnection
  projectRoot: string
  mode: string
  logger: PluginLogger
}

export interface PluginContext extends ConfigContext {
  shopContext: ShopContext
}

export interface ApplyContext extends PluginContext {
  dryRun: boolean
}

export interface RevertContext extends PluginContext {
  dryRun: boolean
}

export interface ErrorContext extends ConfigContext {
  shopContext?: ShopContext
  error: unknown
  phase: PluginPhase
}

export interface PluginHooks {
  configResolved?(ctx: ConfigContext): MaybePromise<void>
  contextReady?(ctx: PluginContext): MaybePromise<void>
  beforeApply?(ctx: ApplyContext): MaybePromise<void>
  afterApply?(ctx: ApplyContext & { result: UpResult }): MaybePromise<void>
  beforeRevert?(ctx: RevertContext): MaybePromise<void>
  afterRevert?(ctx: RevertContext & { result: DownResult }): MaybePromise<void>
  onError?(ctx: ErrorContext): MaybePromise<void>
}

export interface FakewarePlugin {
  name: string
  fetchers?: ShopContextFetcher[]
  hooks?: PluginHooks
}

export function definePlugin(plugin: FakewarePlugin): FakewarePlugin {
  return plugin
}

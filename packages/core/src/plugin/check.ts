import type { ShopwareClient } from '../shopware'
import type { ConfigContext, MaybePromise } from './define'

export type CheckLevel = 'ok' | 'warn' | 'error'

export interface CheckOutcome {
  level: CheckLevel
  message: string
  hint?: string
}

export interface CheckContext extends ConfigContext {
  client: ShopwareClient
}

export type CheckResult = MaybePromise<CheckOutcome | undefined>

export interface PluginCheck {
  name: string
  needsShop?: boolean
  run(ctx: CheckContext): CheckResult
}

export interface CheckReport {
  plugin: string
  check: string
  level: CheckLevel
  message: string
  hint?: string
}

const OFFLINE_MESSAGE =
  'This check reads the shop but is not marked "needsShop: true". Set needsShop on the check.'

export function offlineClient(): ShopwareClient {
  return new Proxy({} as ShopwareClient, {
    get: () => {
      throw new Error(OFFLINE_MESSAGE)
    },
  })
}

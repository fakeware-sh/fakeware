import {
  ApplyStopped,
  GraphError,
  LoadModuleError,
  PluginCheckError,
  RefError,
} from '@fakeware/core'
import { ConfigError } from '@fakeware/core/config'
import {
  ShopContextError,
  ShopwareApiError,
  ShopwareConnectionError,
} from '@fakeware/core/shopware'

export interface JsonErrorDetail {
  code: string
  detail: string
  field: string | null
  recordId: string | null
}

export interface JsonError {
  ok: false
  error: {
    kind: string
    message: string
    entity?: string
    status?: number
    details?: JsonErrorDetail[]
    stack?: string
  }
}

const ERROR_KINDS: ReadonlyArray<readonly [new (...args: never[]) => Error, string]> = [
  [ApplyStopped, 'applyStopped'],
  [ConfigError, 'config'],
  [GraphError, 'graph'],
  [LoadModuleError, 'loadModule'],
  [PluginCheckError, 'pluginCheck'],
  [RefError, 'reference'],
  [ShopContextError, 'shopContext'],
  [ShopwareApiError, 'shopwareApi'],
  [ShopwareConnectionError, 'shopwareConnection'],
]

export function errorKind(error: unknown): string {
  for (const [type, kind] of ERROR_KINDS) {
    if (error instanceof type) return kind
  }
  return 'unexpected'
}

function messageOf(error: unknown): string {
  if (error instanceof ApplyStopped) {
    return 'Stopped. The shop rejected a write, so nothing further was applied.'
  }
  return error instanceof Error ? error.message : String(error)
}

export function toJsonError(error: unknown, verbose = false): JsonError {
  const out: JsonError = { ok: false, error: { kind: errorKind(error), message: messageOf(error) } }

  if (error instanceof ShopwareApiError) {
    if (error.entity !== null) out.error.entity = error.entity
    if (error.status !== null) out.error.status = error.status
    if (error.errors.length > 0) {
      out.error.details = error.errors.map((e) => ({
        code: e.code,
        detail: e.detail,
        field: e.field,
        recordId: e.recordId,
      }))
    }
  }

  if (verbose && error instanceof Error && error.stack) out.error.stack = error.stack
  return out
}

export function jsonUsageError(message: string): JsonError {
  return { ok: false, error: { kind: 'usage', message } }
}

export function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}

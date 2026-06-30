import * as p from '@clack/prompts'
import { ApplyStopped, GraphError, LoadModuleError, RefError } from '@fakeware/core'
import { ConfigError } from '@fakeware/core/config'
import {
  ShopContextError,
  ShopwareApiError,
  ShopwareConnectionError,
} from '@fakeware/core/shopware'

export function reportError(error: unknown): never {
  if (error instanceof ApplyStopped) {
    process.exitCode = 1
    process.exit(1)
  }
  if (error instanceof ShopwareApiError) {
    const lines = [
      error.message,
      ...error.errors.map((e) => `  - ${e.field ? `${e.field}: ` : ''}${e.detail}`),
    ]
    p.cancel(lines.join('\n'))
    process.exit(1)
  }
  if (
    error instanceof ConfigError ||
    error instanceof GraphError ||
    error instanceof LoadModuleError ||
    error instanceof RefError ||
    error instanceof ShopContextError ||
    error instanceof ShopwareConnectionError
  ) {
    p.cancel(error.message)
    process.exit(1)
  }
  throw error
}

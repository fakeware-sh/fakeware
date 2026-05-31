import * as p from '@clack/prompts'
import { GraphError, LoadModuleError, RefError } from '@fakeware/core'
import { ConfigError } from '@fakeware/core/config'
import { ShopwareConnectionError } from '@fakeware/core/shopware'

export function reportError(error: unknown): never {
  if (
    error instanceof ConfigError ||
    error instanceof GraphError ||
    error instanceof LoadModuleError ||
    error instanceof RefError ||
    error instanceof ShopwareConnectionError
  ) {
    p.cancel(error.message)
    process.exit(1)
  }
  throw error
}

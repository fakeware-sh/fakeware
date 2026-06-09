import * as p from '@clack/prompts'
import { GraphError, LoadModuleError, RefError, TransactionError } from '@fakeware/core'
import { ConfigError } from '@fakeware/core/config'
import { ShopContextError, ShopwareConnectionError } from '@fakeware/core/shopware'

function transactionLines(error: TransactionError): string[] {
  const lines = [error.message]
  if (error.compensationErrors.length > 0) {
    lines.push('Some records could not be rolled back.')
  }
  if (error.unrevertableUpdates) {
    lines.push('Updated records were not reverted — re-run `fakeware up` to retry.')
  }
  if (error.cause instanceof Error) {
    lines.push(error.cause.message)
  }
  return lines
}

export function reportError(error: unknown): never {
  if (error instanceof TransactionError) {
    p.cancel(transactionLines(error).join('\n\n'))
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

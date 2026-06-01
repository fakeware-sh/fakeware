import * as p from '@clack/prompts'
import { GraphError, LoadModuleError, RefError, TransactionError } from '@fakeware/core'
import { ConfigError } from '@fakeware/core/config'
import { ShopwareConnectionError } from '@fakeware/core/shopware'

export function reportError(error: unknown): never {
  if (error instanceof TransactionError) {
    const back = error.rolledBack.reduce((n, s) => n + s.deleted, 0)
    const lines = [error.message]
    if (back > 0) {
      lines.push(`Rolled back ${back} change${back === 1 ? '' : 's'}.`)
    }
    if (error.compensationErrors.length > 0) {
      lines.push(
        'Some records could not be rolled back — run `fakeware down` to clean up, then retry.',
      )
    }
    if (error.unrevertableUpdates) {
      lines.push('Updated records were not reverted — re-run `fakeware up` to retry.')
    }
    if (error.cause instanceof Error) {
      lines.push(error.cause.message)
    }
    p.cancel(lines.join('\n'))
    process.exit(1)
  }
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

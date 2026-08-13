import * as p from '@clack/prompts'
import { ApplyStopped, GraphError, LoadModuleError, RefError } from '@fakeware/core'
import { ConfigError } from '@fakeware/core/config'
import {
  ShopContextError,
  ShopwareApiError,
  ShopwareConnectionError,
} from '@fakeware/core/shopware'
import pc from 'picocolors'
import { EXIT_FAILURE, exit } from '../lib/exit-codes'

const KNOWN_ERRORS = [
  ConfigError,
  GraphError,
  LoadModuleError,
  RefError,
  ShopContextError,
  ShopwareConnectionError,
] as const

function isVerbose(argv: string[] = process.argv): boolean {
  return argv.includes('--verbose')
}

function stackOf(error: unknown): string | undefined {
  return error instanceof Error && error.stack ? error.stack : undefined
}

export function reportError(error: unknown, verbose: boolean = isVerbose()): never {
  if (error instanceof ApplyStopped) {
    p.cancel('Stopped. The shop rejected a write, so nothing further was applied.')
    exit(EXIT_FAILURE)
  }

  if (error instanceof ShopwareApiError) {
    const lines = [
      error.message,
      ...error.errors.map((e) => `  - ${e.field ? `${e.field}: ` : ''}${e.detail}`),
    ]
    p.cancel(lines.join('\n'))
    exit(EXIT_FAILURE)
  }

  if (KNOWN_ERRORS.some((type) => error instanceof type)) {
    p.cancel((error as Error).message)
    exit(EXIT_FAILURE)
  }

  const message = error instanceof Error ? error.message : String(error)
  p.cancel(`Unexpected error: ${message}`)
  const stack = stackOf(error)
  if (verbose && stack) p.log.message(pc.dim(stack))
  else p.log.info(`Re-run with ${pc.cyan('--verbose')} to see the full stack trace.`)
  exit(EXIT_FAILURE)
}

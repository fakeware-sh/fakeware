import * as p from '@clack/prompts'
import { EXIT_CANCELLED, exit } from '../lib/exit-codes'

export function cancelable<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    p.cancel('Cancelled.')
    exit(EXIT_CANCELLED)
  }
  return value as T
}

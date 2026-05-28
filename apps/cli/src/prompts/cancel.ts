import * as p from '@clack/prompts'

export function cancelable<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    p.cancel('Cancelled.')
    process.exit(1)
  }
  return value as T
}

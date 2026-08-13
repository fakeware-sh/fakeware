import { InvalidArgumentError } from 'commander'

export function assertOneOf<T extends string>(value: string, allowed: readonly T[]): T {
  if (!allowed.includes(value as T)) {
    throw new InvalidArgumentError(`Expected one of: ${allowed.join(', ')}`)
  }
  return value as T
}

export function assertOneOf<T extends string>(
  value: string,
  allowed: readonly T[],
  flag: string,
): T {
  if (!allowed.includes(value as T)) {
    throw new Error(`Invalid value for ${flag}: "${value}". Expected one of: ${allowed.join(', ')}`)
  }
  return value as T
}

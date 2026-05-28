export type UrlProtocol = 'https' | 'http'

const SCHEME_RE = /^(https?):\/\//i

export function hasProtocol(input: string): boolean {
  return SCHEME_RE.test(input.trim())
}

export function getProtocol(input: string): UrlProtocol | undefined {
  const match = SCHEME_RE.exec(input.trim())
  const scheme = match?.[1]
  return scheme ? (scheme.toLowerCase() as UrlProtocol) : undefined
}

export function normalizeShopUrl(input: string, protocol: UrlProtocol = 'https'): string {
  const trimmed = input.trim().replace(/\/+$/, '')
  if (hasProtocol(trimmed)) return trimmed
  return `${protocol}://${trimmed}`
}

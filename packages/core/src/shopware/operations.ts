import { ApiClientError, type ApiError } from '@shopware/api-client'
import { createShopwareClient, REQUEST_TIMEOUT_MS } from './client'
import { ShopwareConnectionError } from './errors'
import type { ShopwareConnection } from './types'

function safeJsonParse<T>(input: string): T | null {
  try {
    return JSON.parse(input) as T
  } catch {
    return null
  }
}

function isTimeoutError(error: unknown): boolean {
  let current: unknown = error
  while (current instanceof Error) {
    if (current.name === 'TimeoutError') return true
    current = current.cause
  }
  return false
}

function missingPrivileges(error: ApiClientError<{ errors: ApiError[] }>): string[] {
  for (const e of error.details.errors) {
    if (e.code !== 'FRAMEWORK__MISSING_PRIVILEGE_ERROR' || !e.detail) continue
    const parsed = safeJsonParse<{ missingPrivileges?: string[] }>(e.detail)
    if (parsed?.missingPrivileges?.length) return parsed.missingPrivileges
  }
  return []
}

function fieldName(pointer: string | undefined): string | null {
  if (!pointer) return null
  const segments = pointer.split('/').filter((s) => s !== '' && !/^\d+$/.test(s))
  return segments.length ? (segments[segments.length - 1] ?? null) : null
}

function validationMessages(error: ApiClientError<{ errors: ApiError[] }>): string[] {
  return error.details.errors
    .map((e) => {
      const field = fieldName(e.source?.pointer)
      const detail = e.detail ?? e.title ?? 'Invalid value.'
      return field ? `${field}: ${detail}` : detail
    })
    .filter((message, index, all) => all.indexOf(message) === index)
}

export function toConnectionError(
  connection: ShopwareConnection,
  error: unknown,
): ShopwareConnectionError {
  if (isTimeoutError(error)) {
    return new ShopwareConnectionError(
      `${connection.url} did not respond within ${REQUEST_TIMEOUT_MS / 1000}s, the shop may be slow or unreachable.`,
    )
  }
  if (error instanceof ApiClientError) {
    switch (error.status) {
      case 400: {
        const messages = validationMessages(error)
        if (!messages.length) {
          return new ShopwareConnectionError(
            `Shopware rejected the request (HTTP 400) from ${connection.url}.`,
          )
        }
        const shown = messages.slice(0, 5)
        const more = messages.length - shown.length
        const list = shown.map((m) => `  - ${m}`).join('\n')
        const tail = more > 0 ? `\n  - …and ${more} more` : ''
        return new ShopwareConnectionError(`Shopware rejected the data:\n${list}${tail}`)
      }
      case 401:
        return new ShopwareConnectionError(
          'Authentication failed — check the client ID and client secret of your integration.',
        )
      case 403: {
        const missing = missingPrivileges(error)
        if (missing.length) {
          return new ShopwareConnectionError(
            `The integration is missing the ${missing.join(', ')} ${missing.length === 1 ? 'privilege' : 'privileges'} — grant them to its role in Settings → System → Integrations.`,
          )
        }
        return new ShopwareConnectionError(
          'The integration is missing permissions — grant its role admin API access in Settings → System → Integrations.',
        )
      }
      case 404:
        return new ShopwareConnectionError(
          `No Shopware admin API found at ${connection.url} — check the shop URL.`,
        )
      default:
        if (error.status >= 500) {
          return new ShopwareConnectionError(
            `${connection.url} is not responding (HTTP ${error.status}) — the shop may be down or in maintenance.`,
          )
        }
        return new ShopwareConnectionError(
          `Shopware returned an unexpected response (HTTP ${error.status}) from ${connection.url}.`,
        )
    }
  }
  return new ShopwareConnectionError(
    `Could not reach ${connection.url} — check the URL and your network connection.`,
  )
}

export async function validateConnection(connection: ShopwareConnection): Promise<void> {
  const client = createShopwareClient(connection)
  try {
    await client.invoke('infoShopwareVersion get /_info/version')
  } catch (error) {
    throw toConnectionError(connection, error)
  }
}

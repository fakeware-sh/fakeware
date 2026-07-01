import type { ApiClientError, ApiError } from '@shopware/api-client'
import type { SinkRecord } from '../domain'
import { createShopwareClient, REQUEST_TIMEOUT_MS } from './client'
import { type ParsedApiError, ShopwareApiError, ShopwareConnectionError } from './errors'
import type { ShopwareConnection } from './types'

function safeJsonParse<T>(input: string): T | null {
  try {
    return JSON.parse(input) as T
  } catch {
    return null
  }
}

export function isApiClientError(error: unknown): error is ApiClientError<{ errors: ApiError[] }> {
  return (
    error instanceof Error &&
    typeof (error as { status?: unknown }).status === 'number' &&
    Array.isArray((error as { details?: { errors?: unknown } }).details?.errors)
  )
}

export function isTimeoutError(error: unknown): boolean {
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

function pointerSegments(pointer: string | undefined): string[] {
  if (!pointer) return []
  return pointer.split('/').filter((s) => s !== '')
}

function fieldName(pointer: string | undefined): string | null {
  const named = pointerSegments(pointer).filter((s) => !/^\d+$/.test(s))
  return named.length ? (named[named.length - 1] ?? null) : null
}

function recordIdFromPointer(pointer: string | undefined, records: SinkRecord[]): string | null {
  for (const segment of pointerSegments(pointer)) {
    if (/^\d+$/.test(segment)) {
      const index = Number.parseInt(segment, 10)
      return records[index]?.id ?? null
    }
  }
  return null
}

function parseErrors(
  error: ApiClientError<{ errors: ApiError[] }>,
  records: SinkRecord[],
): ParsedApiError[] {
  return error.details.errors.map((e) => ({
    code: e.code ?? 'UNKNOWN',
    detail: e.detail ?? e.title ?? 'Invalid value.',
    field: fieldName(e.source?.pointer),
    pointer: e.source?.pointer ?? null,
    recordId: recordIdFromPointer(e.source?.pointer, records),
  }))
}

export function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500
}

export function toApiError(
  entity: string,
  records: SinkRecord[],
  error: unknown,
): ShopwareApiError {
  if (isTimeoutError(error)) {
    return new ShopwareApiError(`Writing ${entity} timed out.`, {
      status: null,
      entity,
      errors: [],
      retryable: true,
      cause: error,
    })
  }
  if (isApiClientError(error)) {
    const parsed = parseErrors(error, records)
    const summary =
      parsed.length === 1
        ? (parsed[0]?.detail ?? `Shopware rejected ${entity}.`)
        : `Shopware rejected ${parsed.length} ${entity} record${parsed.length === 1 ? '' : 's'}.`
    return new ShopwareApiError(summary, {
      status: error.status,
      entity,
      errors: parsed,
      retryable: isRetryableStatus(error.status),
      cause: error,
    })
  }
  return new ShopwareApiError(`Could not write ${entity}.`, {
    status: null,
    entity,
    errors: [],
    retryable: false,
    cause: error,
  })
}

export function toConnectionError(
  connection: ShopwareConnection,
  error: unknown,
): ShopwareConnectionError {
  if (isTimeoutError(error)) {
    return new ShopwareConnectionError(
      `${connection.url} did not respond within ${REQUEST_TIMEOUT_MS / 1000}s.`,
    )
  }
  if (isApiClientError(error)) {
    switch (error.status) {
      case 400: {
        const messages = parseErrors(error, [])
          .map((e) => (e.field ? `${e.field}: ${e.detail}` : e.detail))
          .filter((m, i, all) => all.indexOf(m) === i)
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
        return new ShopwareConnectionError('Authentication failed.')
      case 403: {
        const missing = missingPrivileges(error)
        if (missing.length) {
          return new ShopwareConnectionError(
            `The integration is missing the ${missing.join(', ')} ${missing.length === 1 ? 'privilege' : 'privileges'}.`,
          )
        }
        return new ShopwareConnectionError('The integration is missing permissions.')
      }
      case 404:
        return new ShopwareConnectionError(`No Shopware admin API found at ${connection.url}.`)
      default:
        if (error.status >= 500) {
          return new ShopwareConnectionError(
            `${connection.url} is not responding (HTTP ${error.status}).`,
          )
        }
        return new ShopwareConnectionError(
          `Shopware returned an unexpected response (HTTP ${error.status}) from ${connection.url}.`,
        )
    }
  }
  return new ShopwareConnectionError(`Could not reach ${connection.url}.`)
}

export async function validateConnection(connection: ShopwareConnection): Promise<void> {
  const client = createShopwareClient(connection)
  try {
    await client.invoke('infoShopwareVersion get /_info/version')
  } catch (error) {
    throw toConnectionError(connection, error)
  }
}

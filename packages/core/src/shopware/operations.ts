import { ApiClientError, type ApiError } from '@shopware/api-client'
import { createShopwareClient } from './client'
import { ShopwareConnectionError } from './errors'
import { parseLanguageRows, toShopInfo } from './locale'
import type { ShopInfo, ShopwareConnection } from './types'

function safeJsonParse<T>(input: string): T | null {
  try {
    return JSON.parse(input) as T
  } catch {
    return null
  }
}

function missingPrivileges(error: ApiClientError<{ errors: ApiError[] }>): string[] {
  for (const e of error.details.errors) {
    if (e.code !== 'FRAMEWORK__MISSING_PRIVILEGE_ERROR' || !e.detail) continue
    const parsed = safeJsonParse<{ missingPrivileges?: string[] }>(e.detail)
    if (parsed?.missingPrivileges?.length) return parsed.missingPrivileges
  }
  return []
}

function toConnectionError(
  connection: ShopwareConnection,
  error: unknown,
): ShopwareConnectionError {
  if (error instanceof ApiClientError) {
    switch (error.status) {
      case 400:
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

export async function fetchShopInfo(connection: ShopwareConnection): Promise<ShopInfo> {
  const client = createShopwareClient(connection)
  try {
    const { data } = await client.invoke('searchLanguage post /search/language', {
      body: { associations: { locale: {} }, limit: 500 },
    })
    return toShopInfo(parseLanguageRows(data.data ?? []))
  } catch (error) {
    throw toConnectionError(connection, error)
  }
}

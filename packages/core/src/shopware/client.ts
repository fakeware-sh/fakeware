import { createAdminAPIClient } from '@shopware/api-client'
import type { operations } from '@shopware/api-client/admin-api-types'
import type { ShopwareConnection } from './types'

export type ShopwareClient = ReturnType<typeof createAdminAPIClient<operations>>

export const REQUEST_TIMEOUT_MS = 120_000

export function createShopwareClient(connection: ShopwareConnection): ShopwareClient {
  return createAdminAPIClient<operations>({
    baseURL: `${connection.url.replace(/\/$/, '')}/api`,
    credentials: {
      grant_type: 'client_credentials',
      client_id: connection.clientId,
      client_secret: connection.clientSecret,
    },
    fetchOptions: {
      timeout: REQUEST_TIMEOUT_MS,
    },
  })
}

import { ApiClientError, createAdminAPIClient } from '@shopware/api-client'
import type { operations } from '@shopware/api-client/admin-api-types'
import { isRetryableStatus, isTimeoutError } from './operations'
import type { ShopwareConnection } from './types'

export type ShopwareClient = ReturnType<typeof createAdminAPIClient<operations>>

export const REQUEST_TIMEOUT_MS = 120_000

export const MAX_ATTEMPTS = 3
const BASE_DELAY_MS = 500
const MAX_DELAY_MS = 8_000

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

function isRetryable(error: unknown): boolean {
  if (isTimeoutError(error)) return true
  if (error instanceof ApiClientError) return isRetryableStatus(error.status)
  return false
}

function backoff(attempt: number): number {
  const delay = BASE_DELAY_MS * 2 ** (attempt - 1)
  const jitter = delay * 0.25 * Math.random()
  return Math.min(delay + jitter, MAX_DELAY_MS)
}

const defaultSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

export interface RetryOptions {
  attempts?: number
  sleep?: (ms: number) => Promise<void>
}

export async function withRetry<T>(task: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const attempts = options.attempts ?? MAX_ATTEMPTS
  const sleep = options.sleep ?? defaultSleep
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await task()
    } catch (error) {
      lastError = error
      if (attempt === attempts || !isRetryable(error)) throw error
      await sleep(backoff(attempt))
    }
  }
  throw lastError
}

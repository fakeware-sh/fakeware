import { isApiClientError, isRetryableStatus, isTimeoutError } from './operations'

export const MAX_ATTEMPTS = 3
const BASE_DELAY_MS = 500
const MAX_DELAY_MS = 8_000

function isRetryable(error: unknown): boolean {
  if (isTimeoutError(error)) return true
  if (isApiClientError(error)) return isRetryableStatus(error.status)
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

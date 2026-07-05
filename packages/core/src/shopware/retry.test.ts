import { describe, expect, test } from 'bun:test'
import { MAX_ATTEMPTS, withRetry } from './retry'

function apiError(status: number): Error {
  const error = new Error(`HTTP ${status}`)
  Object.assign(error, { status, details: { errors: [] } })
  return error
}

function timeoutError(): Error {
  const error = new Error('timed out')
  error.name = 'TimeoutError'
  return error
}

const noSleep = () => Promise.resolve()

describe('withRetry', () => {
  test('returns the result on the first successful attempt', async () => {
    let calls = 0
    const result = await withRetry(
      async () => {
        calls++
        return 'ok'
      },
      { sleep: noSleep },
    )
    expect(result).toBe('ok')
    expect(calls).toBe(1)
  })

  test('retries a retryable error and then succeeds', async () => {
    let calls = 0
    const result = await withRetry(
      async () => {
        calls++
        if (calls < 2) throw apiError(503)
        return 'ok'
      },
      { sleep: noSleep },
    )
    expect(result).toBe('ok')
    expect(calls).toBe(2)
  })

  test('rethrows the last error after exhausting attempts', async () => {
    let calls = 0
    const run = withRetry(
      async () => {
        calls++
        throw apiError(500)
      },
      { sleep: noSleep },
    )
    await expect(run).rejects.toMatchObject({ status: 500 })
    expect(calls).toBe(MAX_ATTEMPTS)
  })

  test('does not retry a non-retryable status', async () => {
    let calls = 0
    let slept = 0
    const run = withRetry(
      async () => {
        calls++
        throw apiError(400)
      },
      {
        sleep: async () => {
          slept++
        },
      },
    )
    await expect(run).rejects.toMatchObject({ status: 400 })
    expect(calls).toBe(1)
    expect(slept).toBe(0)
  })

  test('does not retry a non-api, non-timeout error', async () => {
    let calls = 0
    const run = withRetry(
      async () => {
        calls++
        throw new Error('boom')
      },
      { sleep: noSleep },
    )
    await expect(run).rejects.toThrow('boom')
    expect(calls).toBe(1)
  })

  test('retries a timeout error', async () => {
    let calls = 0
    const result = await withRetry(
      async () => {
        calls++
        if (calls < 2) throw timeoutError()
        return 'ok'
      },
      { sleep: noSleep },
    )
    expect(result).toBe('ok')
    expect(calls).toBe(2)
  })

  test('honours a custom attempts count', async () => {
    let calls = 0
    const run = withRetry(
      async () => {
        calls++
        throw apiError(500)
      },
      { attempts: 5, sleep: noSleep },
    )
    await expect(run).rejects.toMatchObject({ status: 500 })
    expect(calls).toBe(5)
  })

  test('backs off with increasing, capped delays', async () => {
    const delays: number[] = []
    const run = withRetry(
      async () => {
        throw apiError(500)
      },
      {
        attempts: 6,
        sleep: async (ms) => {
          delays.push(ms)
        },
      },
    )
    await expect(run).rejects.toMatchObject({ status: 500 })
    // one sleep per retry (attempts - 1)
    expect(delays).toHaveLength(5)
    // base 500ms, doubling, with up to 25% jitter, capped at 8000ms
    expect(delays[0]).toBeGreaterThanOrEqual(500)
    expect(delays[0]).toBeLessThanOrEqual(625)
    expect(delays[1]).toBeGreaterThanOrEqual(1000)
    expect(delays[1]).toBeLessThanOrEqual(1250)
    for (let i = 1; i < delays.length; i++) {
      expect(delays[i] as number).toBeGreaterThanOrEqual(delays[i - 1] as number)
    }
    expect(Math.max(...delays)).toBeLessThanOrEqual(8000)
  })
})

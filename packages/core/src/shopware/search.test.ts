import { describe, expect, test } from 'bun:test'
import type { ShopwareClient } from './client'
import { invokeAdmin, SEARCH_LIMIT, searchAll, unwrapRows, unwrapTotal } from './search'

interface Call {
  operation: string
  body: Record<string, unknown>
}

function clientOf(pages: unknown[], calls: Call[] = []): ShopwareClient {
  let index = 0
  return {
    invoke: (operation: string, options: { body: Record<string, unknown> }) => {
      calls.push({ operation, body: options.body })
      const page = pages[index] ?? { data: [], total: 0 }
      index += 1
      return Promise.resolve(page)
    },
  } as unknown as ShopwareClient
}

function rows(count: number, offset = 0): { id: string }[] {
  return Array.from({ length: count }, (_, i) => ({ id: `r${offset + i}` }))
}

describe('unwrapRows', () => {
  test('unwraps nested data envelopes down to the row array', () => {
    expect(unwrapRows({ data: { data: [{ id: 'a' }] } })).toEqual([{ id: 'a' }])
  })

  test('returns an empty array for a missing or non-array payload', () => {
    expect(unwrapRows(undefined)).toEqual([])
    expect(unwrapRows({ data: null })).toEqual([])
  })
})

describe('unwrapTotal', () => {
  test('finds the total on the outermost envelope that carries one', () => {
    expect(unwrapTotal({ total: 7, data: [] })).toBe(7)
    expect(unwrapTotal({ data: { total: 3, data: [] } })).toBe(3)
  })

  test('is undefined when no envelope reports a total', () => {
    expect(unwrapTotal({ data: [{ id: 'a' }] })).toBeUndefined()
  })
})

describe('invokeAdmin', () => {
  test('passes the operation and options straight through to the client', async () => {
    const calls: Call[] = []
    const client = clientOf([{ data: [{ id: 'a' }] }], calls)

    const result = await invokeAdmin<{ data: { id: string }[] }>(client, 'searchTax post /tax', {
      body: { limit: 1 },
    })

    expect(calls[0]?.operation).toBe('searchTax post /tax')
    expect(calls[0]?.body).toEqual({ limit: 1 })
    expect(result.data[0]?.id).toBe('a')
  })
})

describe('searchAll', () => {
  test('collects every page until the reported total is reached', async () => {
    const calls: Call[] = []
    const client = clientOf(
      [
        { data: rows(SEARCH_LIMIT), total: SEARCH_LIMIT + 2 },
        { data: rows(2, SEARCH_LIMIT), total: SEARCH_LIMIT + 2 },
      ],
      calls,
    )

    const result = await searchAll<{ id: string }>(client, 'searchTax post /search/tax')

    expect(result.data).toHaveLength(SEARCH_LIMIT + 2)
    expect(result.total).toBe(SEARCH_LIMIT + 2)
    expect(calls.map((c) => c.body.page)).toEqual([1, 2])
  })

  test('stops after a short page when no total is reported', async () => {
    const calls: Call[] = []
    const client = clientOf([{ data: rows(3) }], calls)

    const result = await searchAll(client, 'searchTax post /search/tax')

    expect(result.data).toHaveLength(3)
    expect(calls).toHaveLength(1)
  })

  test('merges the caller body with paging parameters', async () => {
    const calls: Call[] = []
    const client = clientOf([{ data: [] }], calls)

    await searchAll(client, 'searchTax post /search/tax', { associations: { locale: {} } })

    expect(calls[0]?.body).toEqual({
      associations: { locale: {} },
      page: 1,
      limit: SEARCH_LIMIT,
      'total-count-mode': 1,
    })
  })
})

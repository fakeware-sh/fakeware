import { describe, expect, test } from 'bun:test'
import { pickware, pickwareWarehouses, warehouseIdByCode, warehousesFetcher } from './index'

describe('pickware()', () => {
  test('returns a valid fakeware plugin with the warehouses fetcher', () => {
    const plugin = pickware()
    expect(plugin.name).toBe('pickware')
    expect(plugin.fetchers).toEqual([warehousesFetcher])
    expect(plugin.hooks).toBeUndefined()
  })
})

describe('warehousesFetcher', () => {
  test('merges rows from a search response into the extensions bag', () => {
    const extensions: Record<string, unknown> = {}
    const data = { extensions } as Parameters<typeof warehousesFetcher.merge>[0]
    warehousesFetcher.merge(data, { data: { total: 1, data: [{ id: 'wh-1', code: 'WH-01' }] } })
    expect(extensions.pickwareWarehouses).toEqual([{ id: 'wh-1', code: 'WH-01' }])
  })

  test('defaults to an empty list when the response has no data', () => {
    const extensions: Record<string, unknown> = {}
    const data = { extensions } as Parameters<typeof warehousesFetcher.merge>[0]
    warehousesFetcher.merge(data, null)
    expect(extensions.pickwareWarehouses).toEqual([])
  })

  test('fetch posts to the pickware warehouse search endpoint', async () => {
    const calls: Array<[string, unknown]> = []
    const client = {
      invoke: (path: string, params: unknown) => {
        calls.push([path, params])
        return Promise.resolve({ data: { data: [] } })
      },
    } as unknown as Parameters<typeof warehousesFetcher.fetch>[0]
    await warehousesFetcher.fetch(client)
    expect(calls).toEqual([
      [
        'searchPickwareWarehouse post /search/pickware-erp-warehouse',
        { body: { page: 1, limit: 500, 'total-count-mode': 1 } },
      ],
    ])
  })

  test('fetch follows pagination until all rows are collected', async () => {
    const pages: Record<number, PickwareWarehouseRowForTest[]> = {
      1: Array.from({ length: 500 }, (_, i) => ({ id: `wh-${i}`, code: `C${i}` })),
      2: [{ id: 'wh-500', code: 'C500' }],
    }
    const seenPages: number[] = []
    const client = {
      invoke: (_path: string, params: { body: { page: number } }) => {
        const page = params.body.page
        seenPages.push(page)
        return Promise.resolve({ data: { total: 501, data: pages[page] ?? [] } })
      },
    } as unknown as Parameters<typeof warehousesFetcher.fetch>[0]
    const result = await warehousesFetcher.fetch(client)
    expect(seenPages).toEqual([1, 2])
    const extensions: Record<string, unknown> = {}
    const data = { extensions } as Parameters<typeof warehousesFetcher.merge>[0]
    warehousesFetcher.merge(data, result)
    expect((extensions.pickwareWarehouses as unknown[]).length).toBe(501)
  })
})

interface PickwareWarehouseRowForTest {
  id: string
  code: string
}

describe('pickwareWarehouses()', () => {
  test('reads the warehouses out of an extensions bag', () => {
    const rows = [{ id: 'wh-1', code: 'WH-01' }]
    expect(pickwareWarehouses({ pickwareWarehouses: rows })).toEqual(rows)
  })

  test('returns an empty list when nothing was fetched', () => {
    expect(pickwareWarehouses({})).toEqual([])
  })
})

describe('warehouseIdByCode()', () => {
  const extensions = {
    pickwareWarehouses: [
      { id: 'wh-1', code: 'HL' },
      { id: 'wh-2', code: 'B2' },
    ],
  }

  test('resolves a warehouse id by code, case-insensitively', () => {
    expect(warehouseIdByCode(extensions, 'HL')).toBe('wh-1')
    expect(warehouseIdByCode(extensions, 'hl')).toBe('wh-1')
    expect(warehouseIdByCode(extensions, ' b2 ')).toBe('wh-2')
  })

  test('throws an actionable error listing known codes when none matches', () => {
    expect(() => warehouseIdByCode(extensions, 'NOPE')).toThrow(/HL, B2/)
  })
})

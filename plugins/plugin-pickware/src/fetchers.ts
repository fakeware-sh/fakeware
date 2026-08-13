import type { ShopContextFetcher } from '@fakeware/core'

export interface PickwareWarehouseRow {
  id: string
  name?: string
  code?: string
  [key: string]: unknown
}

export const PICKWARE_WAREHOUSES_KEY = 'pickwareWarehouses'

const SEARCH_OPERATION = 'searchPickwareWarehouse post /search/pickware-erp-warehouse'
const SEARCH_LIMIT = 500

export function pickwareWarehouses(extensions: Record<string, unknown>): PickwareWarehouseRow[] {
  return (extensions[PICKWARE_WAREHOUSES_KEY] as PickwareWarehouseRow[] | undefined) ?? []
}

export function warehouseIdByCode(extensions: Record<string, unknown>, code: string): string {
  const warehouses = pickwareWarehouses(extensions)
  const wanted = code.trim().toLowerCase()
  const match = warehouses.find((w) => w.code?.trim().toLowerCase() === wanted)
  if (!match) {
    const known =
      warehouses
        .map((w) => w.code)
        .filter(Boolean)
        .join(', ') || '(none)'
    throw new Error(
      `pickware: no warehouse with code "${code}". Available warehouse codes: ${known}.`,
    )
  }
  return match.id
}

function rowsOf(raw: unknown): unknown[] {
  let value = raw
  while (value && typeof value === 'object' && !Array.isArray(value) && 'data' in value) {
    value = (value as { data?: unknown }).data
  }
  return Array.isArray(value) ? value : []
}

function totalOf(raw: unknown): number | undefined {
  let value = raw
  while (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as { total?: unknown; data?: unknown }
    if (typeof record.total === 'number') return record.total
    if (!('data' in record)) break
    value = record.data
  }
  return undefined
}

type Invoke = (operation: string, options: { body: Record<string, unknown> }) => Promise<unknown>

export const warehousesFetcher: ShopContextFetcher = {
  entity: 'pickware warehouses',
  fetch: async (client) => {
    const invoke = client.invoke as unknown as Invoke
    const collected: unknown[] = []
    let page = 1
    for (;;) {
      const raw = await invoke(SEARCH_OPERATION, {
        body: { page, limit: SEARCH_LIMIT, 'total-count-mode': 1 },
      })
      const pageRows = rowsOf(raw)
      collected.push(...pageRows)
      const total = totalOf(raw)
      if (pageRows.length === 0) break
      if (total !== undefined && collected.length >= total) break
      if (total === undefined && pageRows.length < SEARCH_LIMIT) break
      page += 1
    }
    return { data: collected }
  },
  merge: (data, raw) => {
    data.extensions[PICKWARE_WAREHOUSES_KEY] = rowsOf(raw) as PickwareWarehouseRow[]
  },
}

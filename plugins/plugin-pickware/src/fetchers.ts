import type { ShopContextFetcher } from '@fakeware/core'
import { searchAll, unwrapRows } from '@fakeware/core/shopware'

export interface PickwareWarehouseRow {
  id: string
  name?: string
  code?: string
  [key: string]: unknown
}

export const PICKWARE_WAREHOUSES_KEY = 'pickwareWarehouses'

const SEARCH_OPERATION = 'searchPickwareWarehouse post /search/pickware-erp-warehouse'

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

export const warehousesFetcher: ShopContextFetcher = {
  entity: 'pickware warehouses',
  fetch: (client) => searchAll<PickwareWarehouseRow>(client, SEARCH_OPERATION),
  merge: (data, raw) => {
    data.extensions[PICKWARE_WAREHOUSES_KEY] = unwrapRows<PickwareWarehouseRow>(raw)
  },
}

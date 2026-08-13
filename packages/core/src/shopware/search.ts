import type { ShopwareClient } from './client'

export interface AdminInvokeOptions {
  body?: Record<string, unknown>
  headers?: Record<string, string>
  pathParams?: Record<string, unknown>
}

export interface AdminSearchResult<Row> {
  data: Row[]
  total: number
}

export const SEARCH_LIMIT = 500

export function unwrapRows<Row = Record<string, unknown>>(raw: unknown): Row[] {
  let value: unknown = raw
  while (value && typeof value === 'object' && !Array.isArray(value) && 'data' in value) {
    value = (value as { data?: unknown }).data
  }
  return Array.isArray(value) ? (value as Row[]) : []
}

export function unwrapTotal(raw: unknown): number | undefined {
  let value: unknown = raw
  while (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as { total?: unknown; data?: unknown }
    if (typeof record.total === 'number') return record.total
    if (!('data' in record)) break
    value = record.data
  }
  return undefined
}

export function invokeAdmin<Result = unknown>(
  client: ShopwareClient,
  operation: string,
  options: AdminInvokeOptions = {},
): Promise<Result> {
  return client.invoke(operation as never, options as never) as Promise<Result>
}

export async function searchAll<Row = Record<string, unknown>>(
  client: ShopwareClient,
  operation: string,
  body: Record<string, unknown> = {},
): Promise<AdminSearchResult<Row>> {
  const collected: Row[] = []
  let page = 1
  for (;;) {
    const raw = await invokeAdmin(client, operation, {
      body: { ...body, page, limit: SEARCH_LIMIT, 'total-count-mode': 1 },
    })
    const pageRows = unwrapRows<Row>(raw)
    collected.push(...pageRows)
    const total = unwrapTotal(raw)
    if (pageRows.length === 0) break
    if (total !== undefined && collected.length >= total) break
    if (total === undefined && pageRows.length < SEARCH_LIMIT) break
    page += 1
  }
  return { data: collected, total: collected.length }
}

import type { ShopwareSink, SinkRecord } from '../domain'
import { createShopwareClient, type RetryOptions, type ShopwareClient, withRetry } from './client'
import { ShopwareApiError } from './errors'
import { toApiError } from './operations'
import type { ShopwareConnection } from './types'

export const ENTITY_REQUEST_BYTE_LIMIT = 5 * 1024 * 1024

export interface SyncSinkOptions {
  client?: ShopwareClient
  retry?: RetryOptions
}

function syncBody(entity: string, action: 'upsert' | 'delete', payload: Record<string, unknown>[]) {
  return [{ entity, action, payload }]
}

function guardSize(entity: string, payload: Record<string, unknown>[]): void {
  const bytes = Buffer.byteLength(JSON.stringify(syncBody(entity, 'upsert', payload)), 'utf8')
  if (bytes > ENTITY_REQUEST_BYTE_LIMIT) {
    const mb = (bytes / (1024 * 1024)).toFixed(1)
    const limit = (ENTITY_REQUEST_BYTE_LIMIT / (1024 * 1024)).toFixed(0)
    throw new ShopwareApiError(
      `${entity} is ${mb} MB, over the ${limit} MB single-request limit. Reduce the number of ${entity} records.`,
      { status: null, entity, errors: [], retryable: false, cause: null },
    )
  }
}

export function createSyncSink(
  connection: ShopwareConnection,
  options: SyncSinkOptions = {},
): ShopwareSink {
  const client = options.client ?? createShopwareClient(connection)

  async function sync(
    entity: string,
    action: 'upsert' | 'delete',
    payload: Record<string, unknown>[],
    records: SinkRecord[],
  ): Promise<void> {
    try {
      await withRetry(
        () =>
          client.invoke('sync post /_action/sync', {
            headers: { 'indexing-behavior': 'use-queue-indexing' },
            body: syncBody(entity, action, payload) as never,
          }),
        options.retry,
      )
    } catch (error) {
      if (error instanceof ShopwareApiError) throw error
      throw toApiError(entity, records, error)
    }
  }

  return {
    async write(entity, records): Promise<void> {
      if (records.length === 0) return
      guardSize(entity, records)
      await sync(entity, 'upsert', records, records)
    },
    async delete(entity, ids): Promise<void> {
      if (ids.length === 0) return
      await sync(
        entity,
        'delete',
        ids.map((id) => ({ id })),
        ids.map((id) => ({ id })),
      )
    },
  }
}

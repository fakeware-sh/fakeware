import type { ShopwareSink, SinkRecord, SyncOperation } from '../domain'
import { createShopwareClient, type ShopwareClient } from './client'
import { toConnectionError } from './operations'
import type { ShopwareConnection } from './types'

export interface SyncSinkOptions {
  client?: ShopwareClient
}

const SYNC_BATCH_SIZE = 50

export const ATOMIC_REQUEST_BYTE_LIMIT = 5 * 1024 * 1024

interface SyncBodyEntry {
  entity: string
  action: 'upsert' | 'delete'
  payload: Record<string, unknown>[]
}

function toSyncBody(operations: SyncOperation[]): SyncBodyEntry[] {
  return operations.map((op) =>
    op.action === 'upsert'
      ? { entity: op.entity, action: 'upsert', payload: op.records }
      : { entity: op.entity, action: 'delete', payload: op.ids.map((id) => ({ id })) },
  )
}

export function estimateSyncBytes(operations: SyncOperation[]): number {
  return Buffer.byteLength(JSON.stringify(toSyncBody(operations)), 'utf8')
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
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
  ): Promise<void> {
    for (const batch of chunk(payload, SYNC_BATCH_SIZE)) {
      try {
        await client.invoke('sync post /_action/sync', {
          headers: { 'indexing-behavior': 'use-queue-indexing' },
          body: [{ entity, action, payload: batch as never }],
        })
      } catch (error) {
        throw toConnectionError(connection, error)
      }
    }
  }

  return {
    async upsert(entity: string, records: SinkRecord[]): Promise<void> {
      if (records.length > 0) await sync(entity, 'upsert', records)
    },
    async delete(entity: string, ids: string[]): Promise<void> {
      if (ids.length > 0)
        await sync(
          entity,
          'delete',
          ids.map((id) => ({ id })),
        )
    },
    async applyAtomic(operations: SyncOperation[]): Promise<void> {
      const body = toSyncBody(operations).filter((op) => op.payload.length > 0)
      if (body.length === 0) return
      try {
        await client.invoke('sync post /_action/sync', {
          headers: { 'indexing-behavior': 'use-queue-indexing' },
          body: body as never,
        })
      } catch (error) {
        throw toConnectionError(connection, error)
      }
    },
  }
}

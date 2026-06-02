import type { ShopwareSink, SinkRecord, SyncOperation } from './sink'

export type SinkCall =
  | { op: 'upsert'; entity: string; ids: string[] }
  | { op: 'delete'; entity: string; ids: string[] }
  | { op: 'applyAtomic'; operations: SyncOperation[] }

export interface InMemorySinkOptions {
  failApplyAtomic?: boolean
  failUpsertOn?: string
  failDeleteOn?: string
  failUpsertAfter?: { entity: string; records: number }
}

export interface InMemorySink extends ShopwareSink {
  snapshot(): Map<string, Map<string, SinkRecord>>
  readonly calls: SinkCall[]
}

export function createInMemorySink(options: InMemorySinkOptions = {}): InMemorySink {
  const store = new Map<string, Map<string, SinkRecord>>()
  const calls: SinkCall[] = []

  function bucket(entity: string): Map<string, SinkRecord> {
    let b = store.get(entity)
    if (!b) {
      b = new Map()
      store.set(entity, b)
    }
    return b
  }

  return {
    calls,
    async upsert(entity, records, onBatch) {
      if (options.failUpsertOn === entity) {
        throw new Error(`Simulated upsert failure for ${entity}`)
      }
      const partial = options.failUpsertAfter
      if (partial?.entity === entity) {
        const committed = records.slice(0, partial.records)
        const b = bucket(entity)
        for (const record of committed) b.set(record.id, record)
        calls.push({ op: 'upsert', entity, ids: committed.map((r) => r.id) })
        if (committed.length > 0) {
          onBatch?.({
            records: committed.length,
            recordsTotal: records.length,
            batches: 1,
            batchesTotal: 2,
          })
        }
        throw new Error(`Simulated partial upsert failure for ${entity}`)
      }
      const b = bucket(entity)
      for (const record of records) b.set(record.id, record)
      calls.push({ op: 'upsert', entity, ids: records.map((r) => r.id) })
      if (records.length > 0) {
        onBatch?.({
          records: records.length,
          recordsTotal: records.length,
          batches: 1,
          batchesTotal: 1,
        })
      }
    },
    async delete(entity, ids, onBatch) {
      if (options.failDeleteOn === entity) {
        throw new Error(`Simulated delete failure for ${entity}`)
      }
      const b = bucket(entity)
      for (const id of ids) b.delete(id)
      calls.push({ op: 'delete', entity, ids: [...ids] })
      if (ids.length > 0) {
        onBatch?.({
          records: ids.length,
          recordsTotal: ids.length,
          batches: 1,
          batchesTotal: 1,
        })
      }
    },
    async applyAtomic(operations) {
      if (options.failApplyAtomic) {
        throw new Error('Simulated atomic sync failure')
      }
      for (const op of operations) {
        const b = bucket(op.entity)
        if (op.action === 'upsert') for (const record of op.records) b.set(record.id, record)
        else for (const id of op.ids) b.delete(id)
      }
      calls.push({ op: 'applyAtomic', operations: operations.map((op) => ({ ...op })) })
    },
    snapshot() {
      return store
    },
  }
}

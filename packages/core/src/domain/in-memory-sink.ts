import type { ShopwareSink, SinkRecord } from './sink'

export type SinkCall =
  | { op: 'upsert'; entity: string; ids: string[] }
  | { op: 'delete'; entity: string; ids: string[] }

export interface InMemorySink extends ShopwareSink {
  snapshot(): Map<string, Map<string, SinkRecord>>
  readonly calls: SinkCall[]
}

export function createInMemorySink(): InMemorySink {
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
    async upsert(entity, records) {
      const b = bucket(entity)
      for (const record of records) b.set(record.id, record)
      calls.push({ op: 'upsert', entity, ids: records.map((r) => r.id) })
    },
    async delete(entity, ids) {
      const b = bucket(entity)
      for (const id of ids) b.delete(id)
      calls.push({ op: 'delete', entity, ids: [...ids] })
    },
    snapshot() {
      return store
    },
  }
}

import type { Ctx } from './ctx'
import { deterministicId } from './ids'

type RecordObject = Record<string, unknown>
export type RecordValue = RecordObject | ((ctx: Ctx) => RecordObject)

interface RawEntry {
  entity: string
  key?: string
  value: RecordValue
}

export type DrainedEntries = { entity: string; entries: RawEntry[] }[]

export interface RefIndex {
  byEntity: Map<string, { byKey: Map<string, string>; all: string[] }>
}

let entries: RawEntry[] = []

export function resetRegistry(): void {
  entries = []
}

function staticKey(value: RecordValue): string | undefined {
  if (typeof value !== 'function') {
    const k = (value as RecordObject).$key
    if (typeof k === 'string') return k
  }
  return undefined
}

export function defineRecords(entity: string, recordOrRecords: RecordValue | RecordValue[]): void {
  const list = Array.isArray(recordOrRecords) ? recordOrRecords : [recordOrRecords]
  for (const value of list) {
    entries.push({ entity, key: staticKey(value), value })
  }
}

export function drain(): DrainedEntries {
  const order: string[] = []
  const byEntity = new Map<string, RawEntry[]>()
  for (const e of entries) {
    let bucket = byEntity.get(e.entity)
    if (!bucket) {
      bucket = []
      byEntity.set(e.entity, bucket)
      order.push(e.entity)
    }
    bucket.push(e)
  }
  return order.map((entity) => ({ entity, entries: byEntity.get(entity) as RawEntry[] }))
}

export function buildRefIndex(drained: DrainedEntries): {
  refIndex: RefIndex
  ids: Map<RawEntry, string>
} {
  const refIndex: RefIndex = { byEntity: new Map() }
  const ids = new Map<RawEntry, string>()

  for (const { entity, entries: bucket } of drained) {
    const slot = { byKey: new Map<string, string>(), all: [] as string[] }
    refIndex.byEntity.set(entity, slot)
    bucket.forEach((entry, i) => {
      const idKey = entry.key ?? String(i)
      const id = deterministicId(entity, idKey)
      ids.set(entry, id)
      slot.all.push(id)
      if (entry.key) slot.byKey.set(entry.key, id)
    })
  }

  return { refIndex, ids }
}

export type { RawEntry }

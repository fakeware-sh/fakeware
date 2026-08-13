import { AsyncLocalStorage } from 'node:async_hooks'
import { deterministicId } from '../contract/ids'
import type { Ctx } from './ctx'

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

export interface Registry {
  entries: RawEntry[]
}

export function createRegistry(): Registry {
  return { entries: [] }
}

interface RegistryState {
  storage: AsyncLocalStorage<Registry>
  fallback: Registry
}

const STATE_KEY = Symbol.for('fakeware.registryState')

function registryState(): RegistryState {
  const host = globalThis as typeof globalThis & { [STATE_KEY]?: RegistryState }
  let state = host[STATE_KEY]
  if (!state) {
    state = { storage: new AsyncLocalStorage<Registry>(), fallback: createRegistry() }
    host[STATE_KEY] = state
  }
  return state
}

function activeRegistry(): Registry {
  const { storage, fallback } = registryState()
  return storage.getStore() ?? fallback
}

export async function runWithRegistry<T>(registry: Registry, fn: () => Promise<T>): Promise<T> {
  const state = registryState()
  const previous = state.fallback
  state.fallback = registry
  try {
    return await state.storage.run(registry, fn)
  } finally {
    state.fallback = previous
  }
}

export function staticKey(value: RecordValue): string | undefined {
  if (typeof value !== 'function') {
    const k = (value as RecordObject).$key
    if (typeof k === 'string') return k
  }
  return undefined
}

export function defineRecords(entity: string, recordOrRecords: RecordValue | RecordValue[]): void {
  const list = Array.isArray(recordOrRecords) ? recordOrRecords : [recordOrRecords]
  const { entries } = activeRegistry()
  for (const value of list) {
    entries.push({ entity, key: staticKey(value), value })
  }
}

export function drain(registry?: Registry): DrainedEntries {
  const { entries } = registry ?? activeRegistry()
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

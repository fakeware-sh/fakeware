import {
  buildRefIndex,
  type Ctx,
  type DrainedEntries,
  isPlainObject,
  type RefIndex,
  ref as refById,
  refs as refsByEntity,
  resolveValue,
  setActiveRefIndex,
} from '../define'
import type { SinkRecord } from '../domain'
import { GraphError } from './errors'

export interface WritePlan {
  order: string[]
  records: Map<string, SinkRecord[]>
}

function ownerByIdOf(refIndex: RefIndex): Map<string, string> {
  const owner = new Map<string, string>()
  for (const [entity, slot] of refIndex.byEntity) {
    for (const id of slot.all) owner.set(id, entity)
  }
  return owner
}

function collectIdRefs(value: unknown, ownerById: Map<string, string>, into: Set<string>): void {
  if (typeof value === 'string') {
    const owner = ownerById.get(value)
    if (owner) into.add(owner)
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) collectIdRefs(item, ownerById, into)
    return
  }
  if (isPlainObject(value)) {
    for (const v of Object.values(value)) collectIdRefs(v, ownerById, into)
  }
}

function topoSort(entities: string[], edges: Map<string, Set<string>>): string[] {
  const indegree = new Map<string, number>(entities.map((e) => [e, 0]))
  const dependents = new Map<string, string[]>(entities.map((e) => [e, []]))
  for (const [entity, deps] of edges) {
    for (const dep of deps) {
      indegree.set(entity, (indegree.get(entity) ?? 0) + 1)
      dependents.get(dep)?.push(entity)
    }
  }

  const queue = entities.filter((e) => (indegree.get(e) ?? 0) === 0)
  const ordered: string[] = []
  while (queue.length > 0) {
    const entity = queue.shift() as string
    ordered.push(entity)
    for (const dependent of dependents.get(entity) ?? []) {
      const next = (indegree.get(dependent) ?? 0) - 1
      indegree.set(dependent, next)
      if (next === 0) queue.push(dependent)
    }
  }

  if (ordered.length !== entities.length) {
    const cyclic = entities.filter((e) => !ordered.includes(e))
    throw new GraphError(`Reference cycle between entities: ${cyclic.join(', ')}.`)
  }
  return ordered
}

export function buildWritePlan(drained: DrainedEntries): WritePlan {
  const { refIndex, ids } = buildRefIndex(drained)
  const ownerById = ownerByIdOf(refIndex)
  const entities = drained.map((d) => d.entity)

  const records = new Map<string, SinkRecord[]>()
  const edges = new Map<string, Set<string>>(entities.map((e) => [e, new Set<string>()]))

  setActiveRefIndex(refIndex)
  try {
    for (const { entity, entries } of drained) {
      const out: SinkRecord[] = []
      entries.forEach((entry, i) => {
        const ctx: Ctx = {
          index: i,
          count: entries.length,
          ref: refById,
          refs: refsByEntity,
        }
        const payload = resolveValue(entry.value, ctx) as Record<string, unknown>
        const id = ids.get(entry) as string

        const referenced = new Set<string>()
        collectIdRefs(payload, ownerById, referenced)
        for (const dep of referenced) {
          if (dep !== entity) edges.get(entity)?.add(dep)
        }

        out.push({ ...payload, id })
      })
      records.set(entity, out)
    }
  } finally {
    setActiveRefIndex(undefined)
  }

  return { order: topoSort(entities, edges), records }
}

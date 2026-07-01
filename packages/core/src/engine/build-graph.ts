import {
  buildRefIndex,
  type Ctx,
  type DrainedEntries,
  hashOf,
  type RefIndex,
  type ResolveScope,
  resolveRecord,
} from '../define'
import type { SinkRecord } from '../domain'
import { type ShopContext, setActiveShopContext, shop } from '../shopware/shop-context'
import { GraphError } from './errors'

export interface PlanRecord {
  record: SinkRecord
  hash: string
}

export interface WritePlan {
  order: string[]
  records: Map<string, PlanRecord[]>
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

function sortIntraEntity(
  entity: string,
  out: PlanRecord[],
  keys: (string | undefined)[],
  intraEdges: Map<string, Set<string>>,
): PlanRecord[] {
  if (intraEdges.size === 0) return out

  const indexByKey = new Map<string, number>()
  keys.forEach((key, i) => {
    if (key !== undefined) indexByKey.set(key, i)
  })

  const n = out.length
  const indegree = new Array(n).fill(0)
  const dependents: number[][] = Array.from({ length: n }, () => [])
  for (const [key, deps] of intraEdges) {
    const to = indexByKey.get(key)
    if (to === undefined) continue
    for (const dep of deps) {
      const from = indexByKey.get(dep)
      if (from === undefined) continue
      indegree[to]++
      dependents[from]?.push(to)
    }
  }

  const queue: number[] = []
  for (let i = 0; i < n; i++) {
    if (indegree[i] === 0) queue.push(i)
  }
  const ordered: number[] = []
  while (queue.length > 0) {
    const i = queue.shift() as number
    ordered.push(i)
    for (const dependent of dependents[i] ?? []) {
      if (--indegree[dependent] === 0) queue.push(dependent)
    }
  }

  if (ordered.length !== n) {
    throw new GraphError(`Reference cycle within '${entity}' records.`)
  }
  return ordered.map((i) => out[i] as PlanRecord)
}

function recordSeed(entity: string, index: number): number {
  let h = 2166136261
  const key = `${entity}:${index}`
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function buildWritePlan(drained: DrainedEntries, shopContext: ShopContext): WritePlan {
  const { refIndex, ids } = buildRefIndex(drained)
  const entities = drained.map((d) => d.entity)

  const records = new Map<string, PlanRecord[]>()
  const edges = new Map<string, Set<string>>(entities.map((e) => [e, new Set<string>()]))

  setActiveShopContext(shopContext)
  try {
    for (const { entity, entries } of drained) {
      const out: PlanRecord[] = []
      const keyOfRecord: (string | undefined)[] = []
      const intraEdges = new Map<string, Set<string>>()
      entries.forEach((entry, i) => {
        const ctx: Ctx = {
          index: i,
          count: entries.length,
          seed: recordSeed(entity, i),
          shop,
        }
        const scope: ResolveScope = {
          refIndex: refIndex as RefIndex,
          shop: shopContext,
          seed: ctx.seed,
          onEntityRef: (dep) => {
            if (dep !== entity) edges.get(entity)?.add(dep)
          },
          onKeyRef: (dep, key) => {
            if (dep === entity && entry.key && key !== entry.key) {
              let deps = intraEdges.get(entry.key)
              if (!deps) {
                deps = new Set()
                intraEdges.set(entry.key, deps)
              }
              deps.add(key)
            }
          },
        }
        const { value, canonical } = resolveRecord(entry.value, ctx, scope)
        const id = ids.get(entry) as string
        const payload = value as Record<string, unknown>
        out.push({
          record: { ...payload, id },
          hash: hashOf({ ...(canonical as Record<string, unknown>), id }),
        })
        keyOfRecord.push(entry.key)
      })
      records.set(entity, sortIntraEntity(entity, out, keyOfRecord, intraEdges))
    }
  } finally {
    setActiveShopContext(undefined)
  }

  return { order: topoSort(entities, edges), records }
}

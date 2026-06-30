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
        }
        const { value, canonical } = resolveRecord(entry.value, ctx, scope)
        const id = ids.get(entry) as string
        const payload = value as Record<string, unknown>
        out.push({
          record: { ...payload, id },
          hash: hashOf({ ...(canonical as Record<string, unknown>), id }),
        })
      })
      records.set(entity, out)
    }
  } finally {
    setActiveShopContext(undefined)
  }

  return { order: topoSort(entities, edges), records }
}

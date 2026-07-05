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
import { hoistMedia, MEDIA_ENTITY } from './hoist-media'

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
  intraEdges: Map<number, Set<number>>,
): PlanRecord[] {
  if (intraEdges.size === 0) return out

  const n = out.length
  const indegree = new Array(n).fill(0)
  const dependents: number[][] = Array.from({ length: n }, () => [])
  for (const [to, deps] of intraEdges) {
    for (const from of deps) {
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
  const hoistedMedia = new Map<string, PlanRecord>()

  setActiveShopContext(shopContext)
  try {
    for (const { entity, entries } of drained) {
      const out: PlanRecord[] = []
      const indexById = new Map<string, number>()
      const entityIds = refIndex.byEntity.get(entity)?.all ?? []
      for (let i = 0; i < entityIds.length; i++) {
        indexById.set(entityIds[i] as string, i)
      }
      const intraEdges = new Map<number, Set<number>>()
      entries.forEach((entry, i) => {
        const ownerId = ids.get(entry) as string
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
          onRefId: (dep, id) => {
            if (dep !== entity || id === ownerId) return
            const from = indexById.get(id)
            if (from === undefined) return
            let deps = intraEdges.get(i)
            if (!deps) {
              deps = new Set()
              intraEdges.set(i, deps)
            }
            deps.add(from)
          },
        }
        const resolved = resolveRecord(entry.value, ctx, scope) as {
          value: Record<string, unknown>
          canonical: Record<string, unknown>
        }
        const ownerKey = entry.key ?? String(i)
        const { media } = hoistMedia(entity, ownerKey, resolved)
        for (const m of media) {
          if (hoistedMedia.has(m.id)) continue
          hoistedMedia.set(m.id, {
            record: m.record,
            hash: hashOf({ ...m.canonical, id: m.id }),
          })
        }
        if (media.length > 0 && entity !== MEDIA_ENTITY) {
          edges.get(entity)?.add(MEDIA_ENTITY)
        }

        out.push({
          record: { ...resolved.value, id: ownerId },
          hash: hashOf({ ...resolved.canonical, id: ownerId }),
        })
      })
      records.set(entity, sortIntraEntity(entity, out, intraEdges))
    }
  } finally {
    setActiveShopContext(undefined)
  }

  const planEntities = mergeHoistedMedia(entities, records, edges, hoistedMedia)

  return { order: topoSort(planEntities, edges), records }
}

function mergeHoistedMedia(
  entities: string[],
  records: Map<string, PlanRecord[]>,
  edges: Map<string, Set<string>>,
  hoisted: Map<string, PlanRecord>,
): string[] {
  if (hoisted.size === 0) return entities

  const existing = records.get(MEDIA_ENTITY) ?? []
  const seen = new Set(existing.map((r) => r.record.id))
  const merged = [...existing]
  for (const [id, record] of hoisted) {
    if (seen.has(id)) continue
    seen.add(id)
    merged.push(record)
  }
  records.set(MEDIA_ENTITY, merged)

  if (!edges.has(MEDIA_ENTITY)) edges.set(MEDIA_ENTITY, new Set<string>())
  if (entities.includes(MEDIA_ENTITY)) return entities
  return [MEDIA_ENTITY, ...entities]
}

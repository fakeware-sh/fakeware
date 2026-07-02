import { MEDIA_UPLOAD_KEY } from '../shopware/media'
import type { ShopContext } from '../shopware/shop-context'
import type { Ctx } from './ctx'
import { RefError } from './errors'
import { isPlainObject } from './is-plain-object'
import type { RefIndex } from './registry'
import { type AnyToken, isReferenceToken, isShopToken, isShopValueToken, TOKEN } from './tokens'

export interface ResolveScope {
  refIndex: RefIndex
  shop: ShopContext
  seed: number
  onEntityRef?(entity: string): void
  onKeyRef?(entity: string, key: string): void
}

function slotFor(
  scope: ResolveScope,
  entity: string,
): { byKey: Map<string, string>; all: string[] } {
  const slot = scope.refIndex.byEntity.get(entity)
  if (!slot) throw new RefError(`'${entity}' does not match any defined entity.`)
  return slot
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

function seededIndex(seed: number, length: number): number {
  return Math.floor(seededRandom(seed) * length)
}

function seededSample(seed: number, ids: string[], count: number): string[] {
  const pool = [...ids]
  const n = Math.min(count, pool.length)
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(seededRandom(seed + i * 7919) * pool.length)
    out.push(pool.splice(idx, 1)[0] as string)
  }
  return out
}

function resolveReference(
  token: AnyToken,
  scope: ResolveScope,
): string | string[] | { id: string }[] {
  scope.onEntityRef?.((token as { entity: string }).entity)
  switch (token[TOKEN]) {
    case 'ref': {
      scope.onKeyRef?.(token.entity, token.key)
      const id = slotFor(scope, token.entity).byKey.get(token.key)
      if (!id)
        throw new RefError(`ref('${token.entity}').key('${token.key}') does not match any record.`)
      return id
    }
    case 'ref-index': {
      const all = slotFor(scope, token.entity).all
      const id = all[token.index]
      if (id === undefined) {
        throw new RefError(
          `ref('${token.entity}', ${token.index}) is out of range — ${token.entity} has ${all.length} records.`,
        )
      }
      return id
    }
    case 'refs':
      return [...slotFor(scope, token.entity).all]
    case 'pick': {
      const all = slotFor(scope, token.entity).all
      if (all.length === 0) {
        throw new RefError(`ref('${token.entity}').pick() has no records to choose from.`)
      }
      if (token.count !== null) {
        return seededSample(scope.seed, all, token.count).map((id) => ({ id }))
      }
      return all[seededIndex(scope.seed, all.length)] as string
    }
    default:
      return ''
  }
}

export interface Resolved {
  value: unknown
  canonical: unknown
}

function resolve(value: unknown, ctx: Ctx, scope: ResolveScope): Resolved {
  if (isShopToken(value)) {
    return { value: value.resolve(scope.shop), canonical: `__shop__:${value.descriptor}` }
  }
  if (isShopValueToken(value)) {
    return resolve(value.resolveValue(scope.shop), ctx, scope)
  }
  if (isReferenceToken(value)) {
    const resolved = resolveReference(value, scope)
    return { value: resolved, canonical: resolved }
  }
  if (typeof value === 'function') {
    return resolve((value as (ctx: Ctx) => unknown)(ctx), ctx, scope)
  }
  if (Array.isArray(value)) {
    const out: unknown[] = []
    const canon: unknown[] = []
    for (const item of value) {
      const r = resolve(item, ctx, scope)
      out.push(r.value)
      canon.push(r.canonical)
    }
    return { value: out, canonical: canon }
  }
  if (isPlainObject(value)) {
    const keepKey = MEDIA_UPLOAD_KEY in value
    const out: Record<string, unknown> = {}
    const canon: Record<string, unknown> = {}
    for (const [key, v] of Object.entries(value)) {
      if (key === '$key' && !keepKey) continue
      const r = resolve(v, ctx, scope)
      out[key] = r.value
      canon[key] = r.canonical
    }
    return { value: out, canonical: canon }
  }
  return { value, canonical: value }
}

export function resolveRecord(value: unknown, ctx: Ctx, scope: ResolveScope): Resolved {
  return resolve(value, ctx, scope)
}

export function resolveValue(value: unknown, ctx: Ctx, scope: ResolveScope): unknown {
  return resolve(value, ctx, scope).value
}

import { beforeEach, describe, expect, test } from 'bun:test'
import { shop } from '../shopware/shop-context'
import { fakeShopContext } from '../shopware/shop-context.fixture'
import type { Ctx } from './ctx'
import { define } from './define'
import { RefError } from './errors'
import { buildRefIndex, drain, type RefIndex, resetRegistry } from './registry'
import { type ResolveScope, resolveRecord, resolveValue } from './resolve'
import { pickToken, refIndexToken, refsToken, refToken } from './tokens'

const shopContext = fakeShopContext({
  currencies: [{ id: 'currency-eur', name: 'Euro', isoCode: 'EUR', isSystemDefault: true }],
})

function ctx(index = 0, count = 1, seed = 1): Ctx {
  return { index, count, seed, shop }
}

function scopeFor(
  refIndex: RefIndex,
  seed = 1,
  hooks: Partial<Pick<ResolveScope, 'onEntityRef' | 'onRefId'>> = {},
): ResolveScope {
  return { refIndex, shop: shopContext, seed, ...hooks }
}

function indexFor(): RefIndex {
  return buildRefIndex(drain()).refIndex
}

beforeEach(() => {
  resetRegistry()
})

describe('resolveReference', () => {
  test('ref().key() resolves to the keyed id', () => {
    define('tax', [{ $key: 'standard', taxRate: 19 }])
    const refIndex = indexFor()
    const value = resolveValue(refToken('tax', 'standard'), ctx(), scopeFor(refIndex))
    expect(value).toBe(refIndex.byEntity.get('tax')?.byKey.get('standard'))
    expect(value).toMatch(/^[0-9a-f]{32}$/)
  })

  test('ref().at() resolves positionally', () => {
    define('tax', [
      { $key: 'a', taxRate: 7 },
      { $key: 'b', taxRate: 19 },
    ])
    const refIndex = indexFor()
    const value = resolveValue(refIndexToken('tax', 1), ctx(), scopeFor(refIndex))
    expect(value).toBe(refIndex.byEntity.get('tax')?.all[1])
  })

  test('ref().all() resolves to every id in record order', () => {
    define('tax', [{ $key: 'a' }, { $key: 'b' }, { $key: 'c' }])
    const refIndex = indexFor()
    const value = resolveValue(refsToken('tax'), ctx(), scopeFor(refIndex))
    expect(value).toEqual(refIndex.byEntity.get('tax')?.all)
  })

  test('ref().pick(count) resolves to a deterministic { id } sample', () => {
    define('tax', [{ $key: 'a' }, { $key: 'b' }, { $key: 'c' }])
    const refIndex = indexFor()
    const first = resolveValue(pickToken('tax', 2), ctx(0, 1, 42), scopeFor(refIndex, 42))
    const second = resolveValue(pickToken('tax', 2), ctx(0, 1, 42), scopeFor(refIndex, 42))
    expect(first).toEqual(second)
    expect(Array.isArray(first)).toBe(true)
    expect((first as { id: string }[]).length).toBe(2)
  })

  test('ref().pick() with no count resolves to a single id', () => {
    define('tax', [{ $key: 'a' }, { $key: 'b' }])
    const refIndex = indexFor()
    const value = resolveValue(pickToken('tax', null), ctx(0, 1, 3), scopeFor(refIndex, 3))
    expect(typeof value).toBe('string')
    expect(refIndex.byEntity.get('tax')?.all).toContain(value as string)
  })

  test('throws RefError for an unknown entity', () => {
    const refIndex = indexFor()
    expect(() => resolveValue(refToken('nope', 'x'), ctx(), scopeFor(refIndex))).toThrow(RefError)
  })

  test('throws RefError for a missing key', () => {
    define('tax', [{ $key: 'standard' }])
    const refIndex = indexFor()
    expect(() => resolveValue(refToken('tax', 'missing'), ctx(), scopeFor(refIndex))).toThrow(
      RefError,
    )
  })

  test('throws RefError for an out-of-range index', () => {
    define('tax', [{ $key: 'a' }])
    const refIndex = indexFor()
    expect(() => resolveValue(refIndexToken('tax', 5), ctx(), scopeFor(refIndex))).toThrow(RefError)
  })

  test('throws RefError when pick has no records', () => {
    define('tax', [])
    const refIndex = indexFor()
    expect(() => resolveValue(pickToken('tax', null), ctx(), scopeFor(refIndex))).toThrow(RefError)
  })
})

describe('onRefId callback', () => {
  test('fires for ref().key()', () => {
    define('tax', [{ $key: 'standard' }])
    const refIndex = indexFor()
    const seen: string[] = []
    resolveValue(
      refToken('tax', 'standard'),
      ctx(),
      scopeFor(refIndex, 1, { onRefId: (_e, id) => seen.push(id) }),
    )
    expect(seen).toEqual([refIndex.byEntity.get('tax')?.byKey.get('standard') as string])
  })

  test('fires for ref().at() — the previously-broken selector', () => {
    define('tax', [{ $key: 'a' }, { $key: 'b' }])
    const refIndex = indexFor()
    const seen: string[] = []
    resolveValue(
      refIndexToken('tax', 1),
      ctx(),
      scopeFor(refIndex, 1, { onRefId: (_e, id) => seen.push(id) }),
    )
    expect(seen).toEqual([refIndex.byEntity.get('tax')?.all[1] as string])
  })

  test('fires once per id for ref().all()', () => {
    define('tax', [{ $key: 'a' }, { $key: 'b' }, { $key: 'c' }])
    const refIndex = indexFor()
    const seen: string[] = []
    resolveValue(
      refsToken('tax'),
      ctx(),
      scopeFor(refIndex, 1, { onRefId: (_e, id) => seen.push(id) }),
    )
    expect(seen).toEqual(refIndex.byEntity.get('tax')?.all as string[])
  })

  test('fires for each sampled id for ref().pick(count)', () => {
    define('tax', [{ $key: 'a' }, { $key: 'b' }, { $key: 'c' }])
    const refIndex = indexFor()
    const seen: string[] = []
    const value = resolveValue(
      pickToken('tax', 2),
      ctx(0, 1, 42),
      scopeFor(refIndex, 42, { onRefId: (_e, id) => seen.push(id) }),
    )
    expect(seen).toEqual((value as { id: string }[]).map((x) => x.id))
  })

  test('onEntityRef fires with the referenced entity name', () => {
    define('tax', [{ $key: 'standard' }])
    const refIndex = indexFor()
    const seen: string[] = []
    resolveValue(
      refToken('tax', 'standard'),
      ctx(),
      scopeFor(refIndex, 1, { onEntityRef: (e) => seen.push(e) }),
    )
    expect(seen).toEqual(['tax'])
  })
})

describe('resolve', () => {
  test('resolves shop tokens to ids with a stable canonical marker', () => {
    const refIndex = indexFor()
    const resolved = resolveRecord(shop.currency('EUR'), ctx(), scopeFor(refIndex))
    expect(resolved.value).toBe('currency-eur')
    expect(resolved.canonical).toBe('__shop__:currency:EUR')
  })

  test('invokes function values with the ctx', () => {
    const refIndex = indexFor()
    const value = resolveValue((c: Ctx) => c.index + 10, ctx(5), scopeFor(refIndex))
    expect(value).toBe(15)
  })

  test('recurses into nested arrays and objects', () => {
    const refIndex = indexFor()
    const value = resolveValue({ a: [1, () => 2], b: { c: () => 3 } }, ctx(), scopeFor(refIndex))
    expect(value).toEqual({ a: [1, 2], b: { c: 3 } })
  })

  test('strips $key from plain objects', () => {
    const refIndex = indexFor()
    const value = resolveValue({ $key: 'x', name: 'ok' }, ctx(), scopeFor(refIndex)) as Record<
      string,
      unknown
    >
    expect(value).not.toHaveProperty('$key')
    expect(value.name).toBe('ok')
  })

  test('retains keys on media-upload objects', () => {
    const refIndex = indexFor()
    const value = resolveValue(
      { $key: 'y', __fakewareMedia: { extension: 'jpg', fileName: 'a', source: 'x' } },
      ctx(),
      scopeFor(refIndex),
    ) as Record<string, unknown>
    expect(value).toHaveProperty('$key', 'y')
    expect(value).toHaveProperty('__fakewareMedia')
  })
})

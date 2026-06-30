import { beforeEach, describe, expect, test } from 'bun:test'
import { shop } from '../shopware/shop-context'
import { fakeShopContext } from '../shopware/shop-context.fixture'
import type { Ctx } from './ctx'
import { define, many, pick, ref, refs } from './define'
import { RefError } from './errors'
import { deterministicId } from './ids'
import { buildRefIndex, drain, resetRegistry } from './registry'
import { type ResolveScope, resolveValue } from './resolve'

const shopContext = fakeShopContext()

beforeEach(() => {
  resetRegistry()
})

function scopeFor(): ResolveScope {
  const { refIndex } = buildRefIndex(drain())
  return { refIndex, shop: shopContext, seed: 1 }
}

const baseCtx: Ctx = { index: 3, count: 9, seed: 1, shop }

describe('define + many', () => {
  test('define accepts a single record and an array', () => {
    define('sales_channel', { name: 'Storefront' })
    define('tax', [{ $key: 'standard' }, { $key: 'reduced' }])
    const drained = drain()
    expect(drained.find((d) => d.entity === 'sales_channel')?.entries).toHaveLength(1)
    expect(drained.find((d) => d.entity === 'tax')?.entries).toHaveLength(2)
  })

  test('many produces n entries', () => {
    define(
      'product',
      many(5, () => ({ name: 'x' })),
    )
    expect(drain()[0]?.entries).toHaveLength(5)
  })

  test('static $key drives a stable id; keyless records are positional', () => {
    define('tax', [{ $key: 'standard' }])
    define(
      'product',
      many(2, () => ({ name: 'x' })),
    )
    const { ids } = buildRefIndex(drain())
    const all = [...ids.entries()]
    const tax = all.find(([e]) => e.entity === 'tax')
    expect(tax?.[1]).toBe(deterministicId('tax', 'standard'))
    const products = all.filter(([e]) => e.entity === 'product')
    expect(products[0]?.[1]).toBe(deterministicId('product', '0'))
    expect(products[1]?.[1]).toBe(deterministicId('product', '1'))
  })
})

describe('resolveValue', () => {
  test('calls functions with ctx and recurses into the result', () => {
    expect(resolveValue((c: Ctx) => ({ i: c.index }), baseCtx, scopeFor())).toEqual({ i: 3 })
  })

  test('recurses through nested objects and arrays', () => {
    const value = { a: [{ b: (c: Ctx) => c.count }] }
    expect(resolveValue(value, baseCtx, scopeFor())).toEqual({ a: [{ b: 9 }] })
  })

  test('strips $key from the payload', () => {
    expect(resolveValue({ $key: 'standard', name: 'x' }, baseCtx, scopeFor())).toEqual({
      name: 'x',
    })
  })

  test('leaves primitives and Dates untouched', () => {
    const d = new Date(0)
    expect(resolveValue({ n: 1, s: 'a', d }, baseCtx, scopeFor())).toEqual({ n: 1, s: 'a', d })
  })
})

describe('ref / refs / pick', () => {
  test('ref and refs are pure token constructors (no active context needed)', () => {
    const token = ref('tax/standard')
    expect(token).toMatchObject({ entity: 'tax', key: 'standard' })
    expect(refs('tax')).toMatchObject({ entity: 'tax' })
  })

  test('ref resolves to the keyed id at write time', () => {
    define('product', { $key: 'hero', taxId: ref('tax/standard') })
    define('tax', [{ $key: 'standard' }])
    const scope = scopeFor()
    expect(resolveValue(ref('tax/standard'), baseCtx, scope)).toBe(
      deterministicId('tax', 'standard'),
    )
  })

  test('refs resolves to all ids of an entity in order', () => {
    define('category', [{ $key: 'a' }, { $key: 'b' }])
    const scope = scopeFor()
    expect(resolveValue(refs('category'), baseCtx, scope)).toEqual([
      deterministicId('category', 'a'),
      deterministicId('category', 'b'),
    ])
  })

  test('ref(entity, index) resolves positionally', () => {
    define('category', [{ $key: 'a' }, { $key: 'b' }])
    const scope = scopeFor()
    expect(resolveValue(ref('category', 1), baseCtx, scope)).toBe(deterministicId('category', 'b'))
  })

  test('pick resolves to one deterministic element', () => {
    define('category', [{ $key: 'a' }, { $key: 'b' }, { $key: 'c' }])
    const scope = scopeFor()
    const chosen = resolveValue(pick(refs('category')), baseCtx, scope) as string
    expect([
      deterministicId('category', 'a'),
      deterministicId('category', 'b'),
      deterministicId('category', 'c'),
    ]).toContain(chosen)
  })

  test('unknown ref throws RefError at resolve time', () => {
    define('tax', [{ $key: 'standard' }])
    const scope = scopeFor()
    expect(() => resolveValue(ref('tax/missing'), baseCtx, scope)).toThrow(RefError)
    expect(() => resolveValue(refs('currency'), baseCtx, scope)).toThrow(RefError)
  })

  test('a malformed ref path throws at construction', () => {
    expect(() => ref('noslash' as never)).toThrow(RefError)
  })
})

import { beforeEach, describe, expect, test } from 'bun:test'
import { shop } from '../shopware/shop-context'
import { fakeShopContext } from '../shopware/shop-context.fixture'
import type { Ctx } from './ctx'
import { define, keyed, many, ref } from './define'
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

describe('define return value (typed key map)', () => {
  test('returns a ref token for each static $key', () => {
    const tax = define('tax', [{ $key: 'standard' }, { $key: 'reduced' }])
    expect(tax.standard).toMatchObject({ entity: 'tax', key: 'standard' })
    expect(tax.reduced).toMatchObject({ entity: 'tax', key: 'reduced' })
  })

  test('a returned token resolves to the keyed id at write time', () => {
    const tax = define('tax', [{ $key: 'standard' }])
    const scope = scopeFor()
    expect(resolveValue(tax.standard, baseCtx, scope)).toBe(deterministicId('tax', 'standard'))
  })

  test('function records and many(...) contribute no keys', () => {
    const product = define(
      'product',
      many(3, () => ({ name: 'x' })),
    )
    expect(Object.keys(product)).toHaveLength(0)
  })

  test('duplicate $key within one define throws', () => {
    expect(() => define('tax', [{ $key: 'dup' }, { $key: 'dup' }])).toThrow(RefError)
  })
})

describe('ref builder', () => {
  test('ref(entity).key/at/pick/all are pure token constructors', () => {
    expect(ref('tax').key('standard')).toMatchObject({ entity: 'tax', key: 'standard' })
    expect(ref('category').at(2)).toMatchObject({ entity: 'category', index: 2 })
    expect(ref('category').all()).toMatchObject({ entity: 'category' })
    expect(ref('category').pick()).toMatchObject({ entity: 'category', count: null })
    expect(ref('category').pick(3)).toMatchObject({ entity: 'category', count: 3 })
  })

  test('ref(entity).key resolves to the keyed id at write time', () => {
    define('product', { $key: 'hero', taxId: ref('tax').key('standard') })
    define('tax', [{ $key: 'standard' }])
    const scope = scopeFor()
    expect(resolveValue(ref('tax').key('standard'), baseCtx, scope)).toBe(
      deterministicId('tax', 'standard'),
    )
  })

  test('ref(entity).all resolves to all ids of an entity in order', () => {
    define('category', [{ $key: 'a' }, { $key: 'b' }])
    const scope = scopeFor()
    expect(resolveValue(ref('category').all(), baseCtx, scope)).toEqual([
      deterministicId('category', 'a'),
      deterministicId('category', 'b'),
    ])
  })

  test('ref(entity).at resolves positionally', () => {
    define('category', [{ $key: 'a' }, { $key: 'b' }])
    const scope = scopeFor()
    expect(resolveValue(ref('category').at(1), baseCtx, scope)).toBe(
      deterministicId('category', 'b'),
    )
  })

  test('ref(entity).pick resolves to one deterministic element', () => {
    define('category', [{ $key: 'a' }, { $key: 'b' }, { $key: 'c' }])
    const scope = scopeFor()
    const chosen = resolveValue(ref('category').pick(), baseCtx, scope) as string
    expect([
      deterministicId('category', 'a'),
      deterministicId('category', 'b'),
      deterministicId('category', 'c'),
    ]).toContain(chosen)
  })

  test('unknown ref throws RefError at resolve time', () => {
    define('tax', [{ $key: 'standard' }])
    const scope = scopeFor()
    expect(() => resolveValue(ref('tax').key('missing'), baseCtx, scope)).toThrow(RefError)
    expect(() => resolveValue(ref('currency').all(), baseCtx, scope)).toThrow(RefError)
  })
})

describe('keyed', () => {
  test('stamps a $key on each record from keyFn', () => {
    const records = keyed([{ name: 'Alpha' }, { name: 'Beta' }], (r) => r.name.toLowerCase())
    expect(records).toEqual([
      { name: 'Alpha', $key: 'alpha' },
      { name: 'Beta', $key: 'beta' },
    ])
  })

  test('disambiguates collisions deterministically by insertion order', () => {
    const records = keyed([{ n: 'x' }, { n: 'x' }, { n: 'x' }], (r) => r.n)
    expect(records.map((r) => r.$key)).toEqual(['x', 'x-1', 'x-2'])
  })
})

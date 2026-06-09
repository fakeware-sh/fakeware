import { beforeEach, describe, expect, test } from 'bun:test'
import { shopLookup } from '../shopware/shop-context'
import type { Ctx } from './ctx'
import { define, many, ref, refs, setActiveRefIndex } from './define'
import { RefError } from './errors'
import { deterministicId } from './ids'
import { buildRefIndex, drain, resetRegistry } from './registry'
import { resolveValue } from './resolve'

beforeEach(() => {
  resetRegistry()
  setActiveRefIndex(undefined)
})

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
  const ctx: Ctx = { index: 3, count: 9, ref: () => 'r', refs: () => [], shop: shopLookup }

  test('calls functions with ctx and recurses into the result', () => {
    expect(resolveValue((c: Ctx) => ({ i: c.index }), ctx)).toEqual({ i: 3 })
  })

  test('recurses through nested objects and arrays', () => {
    const value = { a: [{ b: (c: Ctx) => c.count }] }
    expect(resolveValue(value, ctx)).toEqual({ a: [{ b: 9 }] })
  })

  test('strips $key from the payload', () => {
    expect(resolveValue({ $key: 'standard', name: 'x' }, ctx)).toEqual({ name: 'x' })
  })

  test('leaves primitives and Dates untouched', () => {
    const d = new Date(0)
    expect(resolveValue({ n: 1, s: 'a', d }, ctx)).toEqual({ n: 1, s: 'a', d })
  })
})

describe('ref / refs', () => {
  test('resolve independently of definition order', () => {
    define('product', { $key: 'hero', taxId: () => ref('tax/standard') })
    define('tax', [{ $key: 'standard' }])
    const { refIndex } = buildRefIndex(drain())
    setActiveRefIndex(refIndex)
    expect(ref('tax/standard')).toBe(deterministicId('tax', 'standard'))
  })

  test('refs returns all ids of an entity in order', () => {
    define('category', [{ $key: 'a' }, { $key: 'b' }])
    const { refIndex } = buildRefIndex(drain())
    setActiveRefIndex(refIndex)
    expect(refs('category')).toEqual([
      deterministicId('category', 'a'),
      deterministicId('category', 'b'),
    ])
  })

  test('unknown ref throws RefError', () => {
    define('tax', [{ $key: 'standard' }])
    const { refIndex } = buildRefIndex(drain())
    setActiveRefIndex(refIndex)
    expect(() => ref('tax/missing')).toThrow(RefError)
    expect(() => refs('nope')).toThrow(RefError)
    expect(() => ref('noslash')).toThrow(RefError)
  })

  test('ref outside resolution throws', () => {
    expect(() => ref('tax/standard')).toThrow(RefError)
  })
})

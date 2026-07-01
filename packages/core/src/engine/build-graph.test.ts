import { beforeEach, describe, expect, test } from 'bun:test'
import { define, deterministicId, drain, ref, resetRegistry } from '../define'
import { ShopContextError, shop } from '../shopware/shop-context'
import { fakeShopContext } from '../shopware/shop-context.fixture'
import { buildWritePlan } from './build-graph'
import { GraphError } from './errors'

const shopContext = fakeShopContext({
  countries: [{ id: 'country-de', name: 'Germany', iso: 'DE', iso3: 'DEU' }],
  salutations: [{ id: 'sal-mr', name: 'Mr.', salutationKey: 'mr', displayName: 'Mr.' }],
})

beforeEach(() => {
  resetRegistry()
})

describe('buildWritePlan', () => {
  test('orders a referenced entity before its referrer (no thunk needed)', () => {
    define('product', { $key: 'hero', taxId: ref('tax').key('standard') })
    define('tax', [{ $key: 'standard', taxRate: 19 }])
    const plan = buildWritePlan(drain(), shopContext)
    expect(plan.order.indexOf('tax')).toBeLessThan(plan.order.indexOf('product'))
  })

  test('resolves payloads and injects ids', () => {
    define('tax', [{ $key: 'standard', taxRate: 19 }])
    const plan = buildWritePlan(drain(), shopContext)
    const record = plan.records.get('tax')?.[0]?.record
    expect(record?.taxRate).toBe(19)
    expect(record?.id).toMatch(/^[0-9a-f]{32}$/)
    expect(record).not.toHaveProperty('$key')
  })

  test('ignores self-referential entities (same batch)', () => {
    define('category', [{ $key: 'root' }, { $key: 'child', parentId: ref('category').key('root') }])
    const plan = buildWritePlan(drain(), shopContext)
    expect(plan.order).toEqual(['category'])
  })

  test('orders a parent before its child within the same entity, regardless of declaration order', () => {
    define('category', [{ $key: 'child', parentId: ref('category').key('root') }, { $key: 'root' }])
    const plan = buildWritePlan(drain(), shopContext)
    const written = plan.records.get('category') ?? []
    const rootIdx = written.findIndex((r) => r.record.id === deterministicId('category', 'root'))
    const childIdx = written.findIndex((r) => r.record.id === deterministicId('category', 'child'))
    expect(rootIdx).toBeLessThan(childIdx)
  })

  test('throws GraphError on an intra-entity reference cycle', () => {
    define('category', [
      { $key: 'a', parentId: ref('category').key('b') },
      { $key: 'b', parentId: ref('category').key('a') },
    ])
    expect(() => buildWritePlan(drain(), shopContext)).toThrow(GraphError)
  })

  test('throws GraphError on a reference cycle', () => {
    define('product', { $key: 'x', cmsPageId: ref('category').key('y') })
    define('category', { $key: 'y', cmsPageId: ref('product').key('x') })
    expect(() => buildWritePlan(drain(), shopContext)).toThrow(GraphError)
  })

  test('resolves shop tokens directly and via ctx.shop', () => {
    define('order', { $key: 'a', currencyId: shop.currency('EUR') })
    define('order_address', {
      $key: 'a',
      countryId: shop.country('DE'),
      salutationId: (ctx) => ctx.shop.salutation('mr'),
    })
    const plan = buildWritePlan(drain(), shopContext)
    expect(plan.records.get('order')?.[0]?.record.currencyId).toBe('currency-eur')
    expect(plan.records.get('order_address')?.[0]?.record.countryId).toBe('country-de')
    expect(plan.records.get('order_address')?.[0]?.record.salutationId).toBe('sal-mr')
  })

  test('a shop token adds no dependency edge', () => {
    define('product', { $key: 'p', taxId: shop.defaultTax })
    const plan = buildWritePlan(
      drain(),
      fakeShopContext({ taxes: [{ id: 'tax-19', name: 'Std', taxRate: 19 }] }),
    )
    expect(plan.order).toEqual(['product'])
  })

  test('surfaces ShopContextError for an unknown lookup key', () => {
    define('order', { $key: 'a', currencyId: shop.currency('GBP') })
    expect(() => buildWritePlan(drain(), shopContext)).toThrow(ShopContextError)
  })

  test('hash is stable when only the resolved shop id changes', () => {
    define('product', { $key: 'p', taxId: shop.defaultTax })
    const a = buildWritePlan(
      drain(),
      fakeShopContext({ taxes: [{ id: 'tax-AAA', name: 'Std', taxRate: 19 }] }),
    )
    resetRegistry()
    define('product', { $key: 'p', taxId: shop.defaultTax })
    const b = buildWritePlan(
      drain(),
      fakeShopContext({ taxes: [{ id: 'tax-BBB', name: 'Std', taxRate: 19 }] }),
    )
    expect(a.records.get('product')?.[0]?.record.taxId).toBe('tax-AAA')
    expect(b.records.get('product')?.[0]?.record.taxId).toBe('tax-BBB')
    expect(a.records.get('product')?.[0]?.hash).toBe(b.records.get('product')?.[0]?.hash as string)
  })

  test('ref(entity).at resolves positionally', () => {
    define('tax', [
      { $key: 'a', taxRate: 7 },
      { $key: 'b', taxRate: 19 },
    ])
    define('product', { $key: 'p', taxId: ref('tax').at(1) })
    const plan = buildWritePlan(drain(), shopContext)
    const taxIds = plan.records.get('tax')?.map((r) => r.record.id) ?? []
    expect(plan.records.get('product')?.[0]?.record.taxId).toBe(taxIds[1])
  })
})

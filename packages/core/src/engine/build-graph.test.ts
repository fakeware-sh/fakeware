import { beforeEach, describe, expect, test } from 'bun:test'
import { define, drain, ref, resetRegistry, setActiveRefIndex } from '../define'
import { currency, ShopContextError } from '../shopware/shop-context'
import { fakeShopContext } from '../shopware/shop-context.fixture'
import { buildWritePlan } from './build-graph'
import { GraphError } from './errors'

const shopContext = fakeShopContext({
  countries: [{ id: 'country-de', name: 'Germany', iso: 'DE', iso3: 'DEU' }],
  salutations: [{ id: 'sal-mr', name: 'Mr.', salutationKey: 'mr', displayName: 'Mr.' }],
})

beforeEach(() => {
  resetRegistry()
  setActiveRefIndex(undefined)
})

describe('buildWritePlan', () => {
  test('orders a referenced entity before its referrer', () => {
    define('product', { $key: 'hero', taxId: () => ref('tax/standard') })
    define('tax', [{ $key: 'standard', taxRate: 19 }])
    const plan = buildWritePlan(drain(), shopContext)
    expect(plan.order.indexOf('tax')).toBeLessThan(plan.order.indexOf('product'))
  })

  test('resolves payloads and injects ids', () => {
    define('tax', [{ $key: 'standard', taxRate: 19 }])
    const plan = buildWritePlan(drain(), shopContext)
    const record = plan.records.get('tax')?.[0]
    expect(record?.taxRate).toBe(19)
    expect(record?.id).toMatch(/^[0-9a-f]{32}$/)
    expect(record).not.toHaveProperty('$key')
  })

  test('ignores self-referential entities (same batch)', () => {
    define('category', [{ $key: 'root' }, { $key: 'child', parentId: () => ref('category/root') }])
    const plan = buildWritePlan(drain(), shopContext)
    expect(plan.order).toEqual(['category'])
  })

  test('throws GraphError on a reference cycle', () => {
    define('product', { $key: 'x', cmsPageId: () => ref('category/y') })
    define('category', { $key: 'y', cmsPageId: () => ref('product/x') })
    expect(() => buildWritePlan(drain(), shopContext)).toThrow(GraphError)
  })

  test('resolves shop lookups inside record functions, via helper and ctx.shop', () => {
    define('order', { $key: 'a', currencyId: () => currency('EUR').id })
    define('order_address', {
      $key: 'a',
      countryId: (ctx) => ctx.shop.country('DE').id,
      salutationId: (ctx) => ctx.shop.salutation('mr').id,
    })
    const plan = buildWritePlan(drain(), shopContext)
    expect(plan.records.get('order')?.[0]?.currencyId).toBe('currency-eur')
    expect(plan.records.get('order_address')?.[0]?.countryId).toBe('country-de')
    expect(plan.records.get('order_address')?.[0]?.salutationId).toBe('sal-mr')
  })

  test('surfaces ShopContextError for an unknown lookup key', () => {
    define('order', { $key: 'a', currencyId: () => currency('GBP').id })
    expect(() => buildWritePlan(drain(), shopContext)).toThrow(ShopContextError)
  })
})

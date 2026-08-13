import { describe, expect, test } from 'bun:test'
import { type ShopContext, ShopContextError, shop } from '../contract/shop-context'
import { createRegistry, define, deterministicId, drain, ref, runWithRegistry } from '../define'
import { fakeShopContext } from '../shopware/shop-context.fixture'
import { buildWritePlan, type WritePlan } from './build-graph'
import { GraphError } from './errors'

const shopContext = fakeShopContext({
  countries: [{ id: 'country-de', name: 'Germany', iso: 'DE', iso3: 'DEU' }],
  salutations: [{ id: 'sal-mr', name: 'Mr.', salutationKey: 'mr', displayName: 'Mr.' }],
})

function plan(fn: () => void, ctx: ShopContext = shopContext): Promise<WritePlan> {
  return runWithRegistry(createRegistry(), async () => {
    fn()
    return buildWritePlan(drain(), ctx)
  })
}

describe('buildWritePlan', () => {
  test('orders a referenced entity before its referrer (no thunk needed)', async () => {
    const result = await plan(() => {
      define('product', { $key: 'hero', taxId: ref('tax').key('standard') })
      define('tax', [{ $key: 'standard', taxRate: 19 }])
    })
    expect(result.order.indexOf('tax')).toBeLessThan(result.order.indexOf('product'))
  })

  test('resolves payloads and injects ids', async () => {
    const result = await plan(() => {
      define('tax', [{ $key: 'standard', taxRate: 19 }])
    })
    const record = result.records.get('tax')?.[0]?.record
    expect(record?.taxRate).toBe(19)
    expect(record?.id).toMatch(/^[0-9a-f]{32}$/)
    expect(record).not.toHaveProperty('$key')
  })

  test('ignores self-referential entities (same batch)', async () => {
    const result = await plan(() => {
      define('category', [
        { $key: 'root' },
        { $key: 'child', parentId: ref('category').key('root') },
      ])
    })
    expect(result.order).toEqual(['category'])
  })

  test('orders a parent before its child within the same entity, regardless of declaration order', async () => {
    const result = await plan(() => {
      define('category', [
        { $key: 'child', parentId: ref('category').key('root') },
        { $key: 'root' },
      ])
    })
    const written = result.records.get('category') ?? []
    const rootIdx = written.findIndex((r) => r.record.id === deterministicId('category', 'root'))
    const childIdx = written.findIndex((r) => r.record.id === deterministicId('category', 'child'))
    expect(rootIdx).toBeLessThan(childIdx)
  })

  test('throws GraphError on an intra-entity reference cycle', async () => {
    await expect(
      plan(() => {
        define('category', [
          { $key: 'a', parentId: ref('category').key('b') },
          { $key: 'b', parentId: ref('category').key('a') },
        ])
      }),
    ).rejects.toThrow(GraphError)
  })

  test('throws GraphError on a reference cycle', async () => {
    await expect(
      plan(() => {
        define('product', { $key: 'x', cmsPageId: ref('category').key('y') })
        define('category', { $key: 'y', cmsPageId: ref('product').key('x') })
      }),
    ).rejects.toThrow(GraphError)
  })

  test('resolves shop tokens directly and via ctx.shop', async () => {
    const result = await plan(() => {
      define('order', { $key: 'a', currencyId: shop.currency('EUR') })
      define('order_address', {
        $key: 'a',
        countryId: shop.country('DE'),
        salutationId: (ctx) => ctx.shop.salutation('mr'),
      })
    })
    expect(result.records.get('order')?.[0]?.record.currencyId).toBe('currency-eur')
    expect(result.records.get('order_address')?.[0]?.record.countryId).toBe('country-de')
    expect(result.records.get('order_address')?.[0]?.record.salutationId).toBe('sal-mr')
  })

  test('a shop token adds no dependency edge', async () => {
    const result = await plan(
      () => {
        define('product', { $key: 'p', taxId: shop.defaultTax })
      },
      fakeShopContext({ taxes: [{ id: 'tax-19', name: 'Std', taxRate: 19 }] }),
    )
    expect(result.order).toEqual(['product'])
  })

  test('surfaces ShopContextError for an unknown lookup key', async () => {
    await expect(
      plan(() => {
        define('order', { $key: 'a', currencyId: shop.currency('GBP') })
      }),
    ).rejects.toThrow(ShopContextError)
  })

  test('hash is stable when only the resolved shop id changes', async () => {
    const a = await plan(
      () => {
        define('product', { $key: 'p', taxId: shop.defaultTax })
      },
      fakeShopContext({ taxes: [{ id: 'tax-AAA', name: 'Std', taxRate: 19 }] }),
    )
    const b = await plan(
      () => {
        define('product', { $key: 'p', taxId: shop.defaultTax })
      },
      fakeShopContext({ taxes: [{ id: 'tax-BBB', name: 'Std', taxRate: 19 }] }),
    )
    expect(a.records.get('product')?.[0]?.record.taxId).toBe('tax-AAA')
    expect(b.records.get('product')?.[0]?.record.taxId).toBe('tax-BBB')
    expect(a.records.get('product')?.[0]?.hash).toBe(b.records.get('product')?.[0]?.hash as string)
  })

  test('ref(entity).at resolves positionally', async () => {
    const result = await plan(() => {
      define('tax', [
        { $key: 'a', taxRate: 7 },
        { $key: 'b', taxRate: 19 },
      ])
      define('product', { $key: 'p', taxId: ref('tax').at(1) })
    })
    const taxIds = result.records.get('tax')?.map((r) => r.record.id) ?? []
    expect(result.records.get('product')?.[0]?.record.taxId).toBe(taxIds[1])
  })

  test('orders a parent before its child within the same entity via .at()', async () => {
    const result = await plan(() => {
      define('category', [{ $key: 'child', parentId: ref('category').at(1) }, { $key: 'root' }])
    })
    const written = result.records.get('category') ?? []
    const rootIdx = written.findIndex((r) => r.record.id === deterministicId('category', 'root'))
    const childIdx = written.findIndex((r) => r.record.id === deterministicId('category', 'child'))
    expect(rootIdx).toBeLessThan(childIdx)
  })

  test('orders an unkeyed child after the keyed parent it references via .at()', async () => {
    const result = await plan(() => {
      define('category', [{ parentId: ref('category').at(1) }, { $key: 'root' }])
    })
    const written = result.records.get('category') ?? []
    const rootIdx = written.findIndex((r) => r.record.id === deterministicId('category', 'root'))
    const childIdx = written.findIndex((r) => r.record.id === deterministicId('category', '0'))
    expect(rootIdx).toBeLessThan(childIdx)
  })

  test('throws GraphError on an intra-entity cycle expressed via .at()', async () => {
    await expect(
      plan(() => {
        define('category', [
          { $key: 'a', parentId: ref('category').at(1) },
          { $key: 'b', parentId: ref('category').at(0) },
        ])
      }),
    ).rejects.toThrow(GraphError)
  })
})

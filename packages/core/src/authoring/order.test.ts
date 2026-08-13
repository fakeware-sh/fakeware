import { describe, expect, test } from 'bun:test'
import { ShopContextError, withActiveShopContext } from '../contract/shop-context'
import { fakeShopContext } from '../shopware/shop-context.fixture'
import { assocIds } from './local-ids'
import { builders } from './order'

describe('assocIds', () => {
  test('same seed + path + order yields the same id', () => {
    const a = assocIds({ seed: 42 })
    const b = assocIds({ seed: 42 })
    expect(a.next('address')).toBe(b.next('address'))
  })

  test('the counter disambiguates repeats of the same path', () => {
    const ids = assocIds({ seed: 42 })
    const first = ids.next('lineItem')
    const second = ids.next('lineItem')
    expect(first).not.toBe(second)
  })

  test('different seeds yield different ids for the same path', () => {
    expect(assocIds({ seed: 1 }).next('address')).not.toBe(assocIds({ seed: 2 }).next('address'))
  })

  test('ids are 32-char hex (uuidv5 form)', () => {
    expect(assocIds({ seed: 7 }).next('address')).toMatch(/^[0-9a-f]{32}$/)
  })
})

describe('builders — shared counter', () => {
  test('address and lineItem paths never collide within one record', () => {
    const b = builders({ seed: 99 })
    const addr = b.address({ firstName: 'A' })
    const items = b.lineItems.products(
      [
        { product: 'p1', label: 'One', unitPrice: 10 },
        { product: 'p2', label: 'Two', unitPrice: 20 },
      ],
      19,
    )
    const ids = [addr.id, ...items.map((i) => i.id)]
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('order builder', () => {
  const defaultContext = fakeShopContext({
    taxes: [
      { id: 'tax-reduced', name: 'Reduced', taxRate: 7 },
      { id: 'tax-standard', name: 'Standard', taxRate: 19 },
    ],
  })

  function withShop<T>(fn: () => T, ctx = defaultContext): T {
    return withActiveShopContext(ctx, fn)
  }

  test('resolves the default tax rate from the shop context', () => {
    withShop(
      () => {
        const b = builders({ seed: 5 })
        const [item] = b.lineItems.products([{ product: 'p1', label: 'X', unitPrice: 120 }])
        expect(item?.price.calculatedTaxes[0]?.taxRate).toBe(20)
      },
      fakeShopContext({ taxes: [{ id: 'tax-standard', name: 'Standard', taxRate: 20 }] }),
    )
  })

  test('throws when the shop has no taxes and no explicit rate is given', () => {
    withShop(
      () => {
        const b = builders({ seed: 5 })
        expect(() => b.lineItems.products([{ product: 'p1', label: 'X', unitPrice: 10 }])).toThrow(
          ShopContextError,
        )
      },
      fakeShopContext({ taxes: [] }),
    )
  })

  test('an explicit tax rate needs no shop context', () => {
    const b = builders({ seed: 5 })
    const [item] = b.lineItems.products([{ product: 'p1', label: 'X', unitPrice: 10 }], 7)
    expect(item?.price.calculatedTaxes[0]?.taxRate).toBe(7)
  })

  test('billing expands into billingAddressId and addresses[]', () => {
    withShop(() => {
      const b = builders({ seed: 5 })
      const addr = b.address({ firstName: 'Jane', countryId: 'de' })
      const out = b.order({
        orderNumber: '10001',
        billing: addr,
        lineItems: b.lineItems.products([{ product: 'p1', label: 'X', unitPrice: 100 }]),
      })
      expect(out.billingAddressId).toBe(addr.id)
      expect(out.addresses).toEqual([addr])
    })
  })

  test('delivery reuses the billing content but gets its own distinct address id', () => {
    withShop(() => {
      const b = builders({ seed: 5 })
      const addr = b.address({ firstName: 'Jane' })
      const delivery = b.delivery({ ship: addr, method: 'm1' })
      expect(delivery.shippingOrderAddress.firstName).toBe('Jane')
      expect(delivery.shippingOrderAddress.id).not.toBe(addr.id)
    })
  })

  test('is fully deterministic across two identical builds', () => {
    withShop(() => {
      const build = () => {
        const b = builders({ seed: 123 })
        const addr = b.address({ firstName: 'Jane', countryId: 'de' })
        return b.order({
          orderNumber: '10001',
          billing: addr,
          lineItems: b.lineItems.products([
            { product: 'p1', label: 'X', unitPrice: 100, quantity: 2 },
          ]),
          deliveries: [b.delivery({ ship: addr, method: 'm1', cost: 4.99 })],
          payment: b.payment({ method: 'pay1', amount: 204.99 }),
        })
      }
      expect(JSON.stringify(build())).toBe(JSON.stringify(build()))
    })
  })
})

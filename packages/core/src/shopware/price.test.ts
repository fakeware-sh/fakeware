import { describe, expect, test } from 'bun:test'
import { isShopToken, isShopValueToken, shopValueToken } from '../define/tokens'
import { price } from './price'
import type { ShopContext } from './shop-context'

const rate = (n: number) => shopValueToken('test-rate', () => n)
const fakeShop = {} as ShopContext

describe('price.gross', () => {
  test('computes net from gross at the given tax rate and defaults currency to the shop token', () => {
    const p = price.gross(119, { tax: 19 })
    expect(p.gross).toBe(119)
    expect(p.net).toBe(100)
    expect(p.linked).toBe(true)
    expect(isShopToken(p.currencyId)).toBe(true)
  })

  test('accepts an explicit currencyId', () => {
    const p = price.gross(10, { tax: 0, currencyId: 'abc' })
    expect(p.currencyId).toBe('abc')
    expect(p.net).toBe(10)
  })
})

describe('price.calculated', () => {
  test('builds a line-item price block with tax breakdown', () => {
    const p = price.calculated(100, 19, { qty: 2 })
    expect(p.unitPrice).toBe(100)
    expect(p.quantity).toBe(2)
    expect(p.totalPrice).toBe(200)
    expect(p.calculatedTaxes).toEqual([{ tax: 31.93, taxRate: 19, price: 200 }])
    expect(p.taxRules).toEqual([{ taxRate: 19, percentage: 100 }])
    expect(p.referencePrice).toBeNull()
    expect(p.listPrice).toBeNull()
  })

  test('defaults quantity to 1', () => {
    expect(price.calculated(50, 19).quantity).toBe(1)
  })
})

describe('price.cart', () => {
  test('combines positions and shipping into an order-level price', () => {
    const p = price.cart(200, 4.99, 19)
    expect(p.positionPrice).toBe(200)
    expect(p.totalPrice).toBe(204.99)
    expect(p.rawTotal).toBe(204.99)
    expect(p.taxStatus).toBe('gross')
    expect(p.netPrice).toBe(172.26)
    expect(p.calculatedTaxes[0]?.price).toBe(204.99)
  })
})

describe('deferred tax rate token', () => {
  test('gross defers to a value token that resolves net at write-time', () => {
    const p = price.gross(119, { tax: rate(19) })
    expect(isShopValueToken(p)).toBe(true)
    const resolved = p.resolveValue(fakeShop)
    expect(resolved.gross).toBe(119)
    expect(resolved.net).toBe(100)
  })

  test('calculated and cart also defer with a token tax', () => {
    const calc = price.calculated(100, rate(19), { qty: 2 })
    expect(calc.resolveValue(fakeShop).calculatedTaxes[0]?.taxRate).toBe(19)
    const cart = price.cart(200, 0, rate(7))
    expect(cart.resolveValue(fakeShop).taxRules[0]?.taxRate).toBe(7)
  })

  test('a numeric tax stays eager (no token)', () => {
    expect(isShopValueToken(price.gross(10, { tax: 19 }))).toBe(false)
  })
})

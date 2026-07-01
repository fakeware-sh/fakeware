import { describe, expect, test } from 'bun:test'
import { isShopToken } from '../define/tokens'
import { price } from './price'

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

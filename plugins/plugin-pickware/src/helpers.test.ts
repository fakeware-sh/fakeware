import { describe, expect, test } from 'bun:test'
import { isShopToken, type ShopContext, type ShopContextData, shop } from '@fakeware/core'
import { LIVE_VERSION_ID, toShopContext } from '@fakeware/core/shopware'
import { binLocation, productSupplierConfig, returnOrder, supplier } from './helpers'

const PRICE = { net: 10, gross: 11.9, totalPrice: 11.9, taxStatus: 'gross' }
const PRICE_DEF = { type: 'quantity', price: 11.9, quantity: 1, taxRules: [] }

const BASE: ShopContextData = {
  currencies: [{ id: 'currency-eur', name: 'Euro', isoCode: 'EUR', isSystemDefault: true }],
  languages: [{ id: 'language-en', name: 'English', locale: 'en-GB', isSystem: true }],
  salesChannels: [
    {
      id: 'sales-channel-storefront',
      name: 'Storefront',
      typeId: 'type-storefront',
      currencyId: 'currency-eur',
      languageId: 'language-en',
      countryId: null,
      active: true,
    },
  ],
  countries: [],
  salutations: [],
  stateMachineStates: [],
  taxes: [],
  paymentMethods: [],
  shippingMethods: [],
  mediaFolders: [],
  extensions: {},
}

function context(overrides: Partial<ShopContextData>): ShopContext {
  return toShopContext({ ...BASE, ...overrides })
}

function id(value: unknown, ctx: ShopContext): unknown {
  return isShopToken(value) ? value.resolve(ctx) : value
}

describe('supplier()', () => {
  test('defaults languageId to the shop default language token', () => {
    const ctx = context({})
    const record = supplier({ number: 'SUP-1', name: 'ACME' })
    expect(record.number).toBe('SUP-1')
    expect(id(record.languageId, ctx)).toBe('language-en')
  })

  test('keeps $key and customerNumber when provided', () => {
    const record = supplier({ $key: 's1', number: 'SUP-2', name: 'Beta', customerNumber: 'C-9' })
    expect(record.$key).toBe('s1')
    expect(record.customerNumber).toBe('C-9')
  })
})

describe('binLocation()', () => {
  test('resolves the warehouse id from its code via a lazy shop token', () => {
    const ctx = context({ extensions: { pickwareWarehouses: [{ id: 'wh-1', code: 'HL' }] } })
    const record = binLocation({ code: 'A-01-01', warehouseCode: 'hl' })
    expect(record.code).toBe('A-01-01')
    expect(id(record.warehouseId, ctx)).toBe('wh-1')
  })

  test('keeps $key so the record can be referenced', () => {
    const record = binLocation({ $key: 'a1', code: 'A-01-01', warehouseCode: 'HL' })
    expect(record.$key).toBe('a1')
  })

  test('omits $key when none is given', () => {
    const record = binLocation({ code: 'A-01-01', warehouseCode: 'HL' })
    expect('$key' in record).toBe(false)
  })
})

describe('productSupplierConfig()', () => {
  test('passes ids through and applies the live version + defaults', () => {
    const record = productSupplierConfig({
      productId: 'prod-1',
      supplierId: 'sup-1',
      purchasePrices: [{ currencyId: 'c', gross: 1, net: 1, linked: false }],
    })
    expect(record.productId).toBe('prod-1')
    expect(record.supplierId).toBe('sup-1')
    expect(record.productVersionId).toBe(LIVE_VERSION_ID)
    expect(record.minPurchase).toBe(1)
    expect(record.purchaseSteps).toBe(1)
    expect(record.supplierIsDefault).toBe(true)
  })
})

describe('returnOrder()', () => {
  test('defaults stateId to the return-order initial state token', () => {
    const ctx = context({
      stateMachineStates: [
        {
          id: 'state-requested',
          name: 'Requested',
          technicalName: 'requested',
          machineTechnicalName: 'pickware_erp_return_order.state',
        },
      ],
    })
    const record = returnOrder({
      number: 'RET-1',
      orderId: 'order-1',
      price: PRICE,
      lineItems: [{ name: 'Item', quantity: 1, price: PRICE, priceDefinition: PRICE_DEF }],
    })
    expect(id(record.stateId, ctx)).toBe('state-requested')
    expect(record.orderId).toBe('order-1')
    expect(record.versionId).toBe(LIVE_VERSION_ID)
    expect(record.lineItems[0]).toMatchObject({
      type: 'product',
      position: 1,
      reason: 'other',
      versionId: LIVE_VERSION_ID,
    })
  })

  test('resolves stateId from the state machine when a state is given', () => {
    const ctx = context({
      stateMachineStates: [
        {
          id: 'state-received',
          name: 'Received',
          technicalName: 'received',
          machineTechnicalName: 'pickware_erp_return_order.state',
        },
      ],
    })
    const record = returnOrder({
      number: 'RET-2',
      orderId: 'order-2',
      price: PRICE,
      state: 'received',
      lineItems: [
        {
          name: 'Item',
          quantity: 2,
          price: PRICE,
          priceDefinition: PRICE_DEF,
          productId: 'prod-9',
          orderLineItemId: 'oli-9',
        },
      ],
    })
    expect(id(record.stateId, ctx)).toBe('state-received')
    expect(record.lineItems[0]).toMatchObject({
      productId: 'prod-9',
      productVersionId: LIVE_VERSION_ID,
      orderLineItemId: 'oli-9',
      orderLineItemVersionId: LIVE_VERSION_ID,
    })
  })

  test('omits stateId entirely when state is false', () => {
    const record = returnOrder({
      number: 'RET-3',
      orderId: 'order-3',
      price: PRICE,
      state: false,
      lineItems: [{ name: 'Item', quantity: 1, price: PRICE, priceDefinition: PRICE_DEF }],
    })
    expect('stateId' in record).toBe(false)
  })
})

test('shop helper is exported for plugin authors', () => {
  expect(typeof shop.defaultLanguage.resolve).toBe('function')
})

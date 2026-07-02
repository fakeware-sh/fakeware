import { afterEach, describe, expect, test } from 'bun:test'
import { type ShopContext, ShopContextError, setActiveShopContext, shop } from './shop-context'
import { fakeShopContext } from './shop-context.fixture'

const ctx = fakeShopContext({
  currencies: [
    { id: 'cur-eur', name: 'Euro', isoCode: 'EUR', isSystemDefault: true },
    { id: 'cur-usd', name: 'US Dollar', isoCode: 'USD', isSystemDefault: false },
  ],
  languages: [
    { id: 'lang-en', name: 'English', locale: 'en-GB', isSystem: false },
    { id: 'lang-de', name: 'Deutsch', locale: 'de-DE', isSystem: false },
  ],
  salesChannels: [
    {
      id: 'sc-store',
      name: 'Storefront',
      typeId: 'type-store',
      currencyId: 'cur-eur',
      languageId: 'lang-en',
      countryId: 'country-de',
      active: true,
    },
  ],
  countries: [
    { id: 'country-de', name: 'Germany', iso: 'DE', iso3: 'DEU' },
    { id: 'country-us', name: 'United States', iso: 'US', iso3: 'USA' },
  ],
  salutations: [{ id: 'sal-mr', name: 'Mr.', salutationKey: 'mr', displayName: 'Mr.' }],
  stateMachineStates: [
    { id: 'os-open', name: 'Open', technicalName: 'open', machineTechnicalName: 'order.state' },
    {
      id: 'ods-open',
      name: 'Open',
      technicalName: 'open',
      machineTechnicalName: 'order_delivery.state',
    },
    {
      id: 'ots-open',
      name: 'Open',
      technicalName: 'open',
      machineTechnicalName: 'order_transaction.state',
    },
  ],
  taxes: [
    { id: 'tax-7', name: 'Reduced', taxRate: 7 },
    { id: 'tax-19', name: 'Standard', taxRate: 19 },
  ],
  paymentMethods: [{ id: 'pm-invoice', name: 'Invoice', technicalName: 'fakeware_invoice' }],
  shippingMethods: [{ id: 'sm-standard', name: 'Standard', technicalName: 'fakeware_standard' }],
})

function id(token: { resolve(s: ShopContext): string }): string {
  return token.resolve(ctx)
}

afterEach(() => {
  setActiveShopContext(undefined)
})

describe('shop tokens', () => {
  test('resolve records by meaning', () => {
    expect(id(shop.currency('EUR'))).toBe('cur-eur')
    expect(id(shop.language('de-DE'))).toBe('lang-de')
    expect(id(shop.country('DE'))).toBe('country-de')
    expect(id(shop.salutation('mr'))).toBe('sal-mr')
    expect(id(shop.tax(19))).toBe('tax-19')
    expect(id(shop.paymentMethod('fakeware_invoice'))).toBe('pm-invoice')
    expect(id(shop.shippingMethod('fakeware_standard'))).toBe('sm-standard')
  })

  test('currency and country lookups are case-insensitive', () => {
    expect(id(shop.currency('eur'))).toBe('cur-eur')
    expect(id(shop.country('de'))).toBe('country-de')
  })

  test('resolves the order state machines', () => {
    expect(id(shop.orderState('open'))).toBe('os-open')
    expect(id(shop.orderDeliveryState('open'))).toBe('ods-open')
    expect(id(shop.orderTransactionState('open'))).toBe('ots-open')
    expect(id(shop.stateMachineState('order.state', 'open'))).toBe('os-open')
  })

  test('resolves defaults', () => {
    expect(id(shop.defaultSalesChannel)).toBe('sc-store')
    expect(id(shop.defaultCurrency)).toBe('cur-eur')
    expect(id(shop.defaultLanguage)).toBe('lang-en')
    expect(id(shop.defaultCountry)).toBe('country-de')
    expect(id(shop.defaultSalutation)).toBe('sal-mr')
    expect(id(shop.defaultTax)).toBe('tax-19')
    expect(id(shop.defaultPaymentMethod)).toBe('pm-invoice')
    expect(id(shop.defaultShippingMethod)).toBe('sm-standard')
  })

  test('exposes tax rates as value tokens resolved from context', () => {
    expect(shop.defaultTaxRate.resolveValue(ctx)).toBe(19)
    expect(shop.taxRate(7).resolveValue(ctx)).toBe(7)
  })

  test('a stable descriptor is independent of the resolved id', () => {
    expect(shop.defaultCurrency.descriptor).toBe('defaultCurrency')
    expect(shop.country('DE').descriptor).toBe('country:DE')
  })

  test('a missing key throws ShopContextError listing what is available', () => {
    expect(() => id(shop.currency('GBP'))).toThrow(ShopContextError)
    expect(() => id(shop.currency('GBP'))).toThrow(/EUR/)
    expect(() => id(shop.country('ZZ'))).toThrow(/DE/)
  })

  test('a missing state names the states of that machine', () => {
    expect(() => id(shop.orderState('closed'))).toThrow(ShopContextError)
    expect(() => id(shop.orderState('closed'))).toThrow(/order\.state/)
    expect(() => id(shop.orderState('closed'))).toThrow(/open/)
  })
})

describe('eager context access', () => {
  test('context()/extensions throw before a context is active', () => {
    setActiveShopContext(undefined)
    expect(() => shop.context()).toThrow(ShopContextError)
    expect(() => shop.extensions).toThrow(ShopContextError)
  })

  test('context()/extensions read the active context', () => {
    setActiveShopContext(ctx)
    expect(shop.context()).toBe(ctx)
    expect(shop.extensions).toBe(ctx.extensions)
  })
})

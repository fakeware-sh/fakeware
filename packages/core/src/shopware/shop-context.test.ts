import { afterEach, describe, expect, test } from 'bun:test'
import {
  country,
  createShopLookup,
  currency,
  defaultCurrency,
  defaultLanguage,
  defaultSalesChannel,
  orderDeliveryState,
  orderState,
  orderTransactionState,
  paymentMethod,
  ShopContextError,
  salutation,
  setActiveShopContext,
  shippingMethod,
  shopLookup,
  stateMachineState,
  tax,
} from './shop-context'
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
  taxes: [{ id: 'tax-19', name: 'Standard', taxRate: 19 }],
  paymentMethods: [{ id: 'pm-invoice', name: 'Invoice', technicalName: 'fakeware_invoice' }],
  shippingMethods: [{ id: 'sm-standard', name: 'Standard', technicalName: 'fakeware_standard' }],
})

afterEach(() => {
  setActiveShopContext(undefined)
})

describe('createShopLookup', () => {
  const lookup = createShopLookup(ctx)

  test('resolves records by meaning', () => {
    expect(lookup.currency('EUR').id).toBe('cur-eur')
    expect(lookup.language('de-DE').id).toBe('lang-de')
    expect(lookup.country('DE').id).toBe('country-de')
    expect(lookup.salutation('mr').id).toBe('sal-mr')
    expect(lookup.tax(19).id).toBe('tax-19')
    expect(lookup.paymentMethod('fakeware_invoice').id).toBe('pm-invoice')
    expect(lookup.shippingMethod('fakeware_standard').id).toBe('sm-standard')
  })

  test('currency and country lookups are case-insensitive', () => {
    expect(lookup.currency('eur').id).toBe('cur-eur')
    expect(lookup.country('de').id).toBe('country-de')
  })

  test('resolves the order state machines', () => {
    expect(lookup.orderState('open').id).toBe('os-open')
    expect(lookup.orderDeliveryState('open').id).toBe('ods-open')
    expect(lookup.orderTransactionState('open').id).toBe('ots-open')
    expect(lookup.stateMachineState('order.state', 'open').id).toBe('os-open')
  })

  test('resolves defaults from the active sales channel and the system flags', () => {
    expect(lookup.defaultSalesChannel().id).toBe('sc-store')
    expect(lookup.defaultCurrency().id).toBe('cur-eur')
    expect(lookup.defaultLanguage().id).toBe('lang-en')
  })

  test('a missing key throws ShopContextError listing what is available', () => {
    expect(() => lookup.currency('GBP')).toThrow(ShopContextError)
    expect(() => lookup.currency('GBP')).toThrow(/EUR/)
    expect(() => lookup.country('ZZ')).toThrow(/DE/)
  })

  test('a missing state names the states of that machine', () => {
    expect(() => lookup.orderState('closed')).toThrow(ShopContextError)
    expect(() => lookup.orderState('closed')).toThrow(/order\.state/)
    expect(() => lookup.orderState('closed')).toThrow(/open/)
  })
})

describe('module-global lookups', () => {
  test('standalone helpers throw before a context is active', () => {
    setActiveShopContext(undefined)
    expect(() => currency('EUR')).toThrow(ShopContextError)
    expect(() => defaultLanguage()).toThrow(ShopContextError)
  })

  test('helpers and shopLookup resolve once a context is active', () => {
    setActiveShopContext(ctx)
    expect(currency('EUR').id).toBe('cur-eur')
    expect(country('DE').id).toBe('country-de')
    expect(salutation('mr').id).toBe('sal-mr')
    expect(defaultCurrency().id).toBe('cur-eur')
    expect(defaultSalesChannel().id).toBe('sc-store')
    expect(tax(19).id).toBe('tax-19')
    expect(paymentMethod('fakeware_invoice').id).toBe('pm-invoice')
    expect(shippingMethod('fakeware_standard').id).toBe('sm-standard')
    expect(orderState('open').id).toBe('os-open')
    expect(orderDeliveryState('open').id).toBe('ods-open')
    expect(orderTransactionState('open').id).toBe('ots-open')
    expect(stateMachineState('order.state', 'open').id).toBe('os-open')
    expect(shopLookup.currency('EUR').id).toBe('cur-eur')
    expect(shopLookup.context()).toBe(ctx)
  })

  test('clearing the context makes helpers throw again', () => {
    setActiveShopContext(ctx)
    expect(currency('EUR').id).toBe('cur-eur')
    setActiveShopContext(undefined)
    expect(() => currency('EUR')).toThrow(ShopContextError)
  })
})

export interface ShopContextRecord {
  id: string
  name: string
}

export interface ShopContextCurrency extends ShopContextRecord {
  isoCode: string
  isSystemDefault: boolean
}

export interface ShopContextLanguage extends ShopContextRecord {
  locale: string
  isSystem: boolean
}

export interface ShopContextSalesChannel extends ShopContextRecord {
  typeId: string
  currencyId: string
  languageId: string
  active: boolean
}

export interface ShopContextCountry extends ShopContextRecord {
  iso: string
  iso3: string
}

export interface ShopContextSalutation extends ShopContextRecord {
  salutationKey: string
  displayName: string
}

export interface ShopContextStateMachineState extends ShopContextRecord {
  technicalName: string
  machineTechnicalName: string
}

export interface ShopContextTax extends ShopContextRecord {
  taxRate: number
}

export interface ShopContextPaymentMethod extends ShopContextRecord {
  technicalName: string
}

export interface ShopContextShippingMethod extends ShopContextRecord {
  technicalName: string
}

export interface ShopContextData {
  currencies: ShopContextCurrency[]
  languages: ShopContextLanguage[]
  salesChannels: ShopContextSalesChannel[]
  countries: ShopContextCountry[]
  salutations: ShopContextSalutation[]
  stateMachineStates: ShopContextStateMachineState[]
  taxes: ShopContextTax[]
  paymentMethods: ShopContextPaymentMethod[]
  shippingMethods: ShopContextShippingMethod[]
  extensions: Record<string, unknown>
}

export interface ShopContextIndex {
  currencyByIso: Map<string, ShopContextCurrency>
  currencyDefault: ShopContextCurrency
  languageByLocale: Map<string, ShopContextLanguage>
  languageSystem: ShopContextLanguage
  salesChannelByName: Map<string, ShopContextSalesChannel>
  salesChannelDefault: ShopContextSalesChannel
  countryByIso: Map<string, ShopContextCountry>
  salutationByKey: Map<string, ShopContextSalutation>
  stateByMachineState: Map<string, ShopContextStateMachineState>
  taxByRate: Map<number, ShopContextTax>
  paymentMethodByTechnicalName: Map<string, ShopContextPaymentMethod>
  shippingMethodByTechnicalName: Map<string, ShopContextShippingMethod>
}

export interface ShopContext extends ShopContextData {
  readonly index: ShopContextIndex
}

export class ShopContextError extends Error {}

export interface ShopLookup {
  context(): ShopContext
  currency(isoCode: string): ShopContextCurrency
  defaultCurrency(): ShopContextCurrency
  language(locale: string): ShopContextLanguage
  defaultLanguage(): ShopContextLanguage
  salesChannel(name: string): ShopContextSalesChannel
  defaultSalesChannel(): ShopContextSalesChannel
  country(iso: string): ShopContextCountry
  salutation(key: string): ShopContextSalutation
  stateMachineState(machine: string, technicalName: string): ShopContextStateMachineState
  orderState(technicalName: string): ShopContextStateMachineState
  orderDeliveryState(technicalName: string): ShopContextStateMachineState
  orderTransactionState(technicalName: string): ShopContextStateMachineState
  tax(rate: number): ShopContextTax
  paymentMethod(technicalName: string): ShopContextPaymentMethod
  shippingMethod(technicalName: string): ShopContextShippingMethod
}

function missing(kind: string, key: string, available: string[]): ShopContextError {
  const list = available.length ? available.join(', ') : '(none returned by the shop)'
  return new ShopContextError(`${kind} '${key}' not found. Available: ${list}.`)
}

export function createShopLookup(ctx: ShopContext): ShopLookup {
  const i = ctx.index
  const state = (machine: string, technicalName: string): ShopContextStateMachineState => {
    const found = i.stateByMachineState.get(`${machine}::${technicalName}`)
    if (!found) {
      const states = ctx.stateMachineStates
        .filter((s) => s.machineTechnicalName === machine)
        .map((s) => s.technicalName)
      const hint = states.length ? states.join(', ') : `(machine '${machine}' not found)`
      throw new ShopContextError(
        `stateMachineState('${machine}', '${technicalName}') not found. States for '${machine}': ${hint}.`,
      )
    }
    return found
  }
  return {
    context: () => ctx,
    currency: (isoCode) => {
      const found = i.currencyByIso.get(isoCode.toUpperCase())
      if (!found) throw missing('currency', isoCode, [...i.currencyByIso.keys()])
      return found
    },
    defaultCurrency: () => i.currencyDefault,
    language: (locale) => {
      const found = i.languageByLocale.get(locale)
      if (!found) throw missing('language', locale, [...i.languageByLocale.keys()])
      return found
    },
    defaultLanguage: () => i.languageSystem,
    salesChannel: (name) => {
      const found = i.salesChannelByName.get(name)
      if (!found) throw missing('salesChannel', name, [...i.salesChannelByName.keys()])
      return found
    },
    defaultSalesChannel: () => i.salesChannelDefault,
    country: (iso) => {
      const found = i.countryByIso.get(iso.toUpperCase())
      if (!found) throw missing('country', iso, [...i.countryByIso.keys()])
      return found
    },
    salutation: (key) => {
      const found = i.salutationByKey.get(key)
      if (!found) throw missing('salutation', key, [...i.salutationByKey.keys()])
      return found
    },
    stateMachineState: state,
    orderState: (technicalName) => state('order.state', technicalName),
    orderDeliveryState: (technicalName) => state('order_delivery.state', technicalName),
    orderTransactionState: (technicalName) => state('order_transaction.state', technicalName),
    tax: (rate) => {
      const found = i.taxByRate.get(rate)
      if (!found) throw missing('tax', String(rate), [...i.taxByRate.keys()].map(String))
      return found
    },
    paymentMethod: (technicalName) => {
      const found = i.paymentMethodByTechnicalName.get(technicalName)
      if (!found) {
        throw missing('paymentMethod', technicalName, [...i.paymentMethodByTechnicalName.keys()])
      }
      return found
    },
    shippingMethod: (technicalName) => {
      const found = i.shippingMethodByTechnicalName.get(technicalName)
      if (!found) {
        throw missing('shippingMethod', technicalName, [...i.shippingMethodByTechnicalName.keys()])
      }
      return found
    },
  }
}

let active: ShopLookup | undefined

export function setActiveShopContext(ctx: ShopContext | undefined): void {
  active = ctx ? createShopLookup(ctx) : undefined
}

function requireActive(): ShopLookup {
  if (!active) {
    throw new ShopContextError(
      'Shop lookups may only be called while resolving definitions. Wrap the call in a ' +
        "function, e.g. define('order', () => ({ currencyId: currency('EUR').id })).",
    )
  }
  return active
}

export const shopLookup: ShopLookup = {
  context: () => requireActive().context(),
  currency: (isoCode) => requireActive().currency(isoCode),
  defaultCurrency: () => requireActive().defaultCurrency(),
  language: (locale) => requireActive().language(locale),
  defaultLanguage: () => requireActive().defaultLanguage(),
  salesChannel: (name) => requireActive().salesChannel(name),
  defaultSalesChannel: () => requireActive().defaultSalesChannel(),
  country: (iso) => requireActive().country(iso),
  salutation: (key) => requireActive().salutation(key),
  stateMachineState: (machine, technicalName) =>
    requireActive().stateMachineState(machine, technicalName),
  orderState: (technicalName) => requireActive().orderState(technicalName),
  orderDeliveryState: (technicalName) => requireActive().orderDeliveryState(technicalName),
  orderTransactionState: (technicalName) => requireActive().orderTransactionState(technicalName),
  tax: (rate) => requireActive().tax(rate),
  paymentMethod: (technicalName) => requireActive().paymentMethod(technicalName),
  shippingMethod: (technicalName) => requireActive().shippingMethod(technicalName),
}

export const shop = shopLookup.context
export const currency = shopLookup.currency
export const defaultCurrency = shopLookup.defaultCurrency
export const language = shopLookup.language
export const defaultLanguage = shopLookup.defaultLanguage
export const salesChannel = shopLookup.salesChannel
export const defaultSalesChannel = shopLookup.defaultSalesChannel
export const country = shopLookup.country
export const salutation = shopLookup.salutation
export const stateMachineState = shopLookup.stateMachineState
export const orderState = shopLookup.orderState
export const orderDeliveryState = shopLookup.orderDeliveryState
export const orderTransactionState = shopLookup.orderTransactionState
export const tax = shopLookup.tax
export const paymentMethod = shopLookup.paymentMethod
export const shippingMethod = shopLookup.shippingMethod

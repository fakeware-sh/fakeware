import { type ShopToken, type ShopValueToken, shopToken, shopValueToken } from '../define/tokens'

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
  countryId: string | null
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

export interface ShopContextMediaFolder extends ShopContextRecord {
  entity: string
}

export interface ShopContextExtensions {
  [key: string]: unknown
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
  mediaFolders: ShopContextMediaFolder[]
  extensions: ShopContextExtensions
}

export interface ShopContextIndex {
  currencyByIso: Map<string, ShopContextCurrency>
  currencyDefault: ShopContextCurrency
  languageByLocale: Map<string, ShopContextLanguage>
  languageDefault: ShopContextLanguage
  salesChannelByName: Map<string, ShopContextSalesChannel>
  salesChannelDefault: ShopContextSalesChannel
  countryByIso: Map<string, ShopContextCountry>
  countryDefault: ShopContextCountry | null
  salutationByKey: Map<string, ShopContextSalutation>
  salutationDefault: ShopContextSalutation | null
  stateByMachineState: Map<string, ShopContextStateMachineState>
  taxByRate: Map<number, ShopContextTax>
  taxDefault: ShopContextTax | null
  paymentMethodByTechnicalName: Map<string, ShopContextPaymentMethod>
  paymentMethodDefault: ShopContextPaymentMethod | null
  shippingMethodByTechnicalName: Map<string, ShopContextShippingMethod>
  shippingMethodDefault: ShopContextShippingMethod | null
  mediaFolderByEntity: Map<string, ShopContextMediaFolder>
}

export interface ShopContext extends ShopContextData {
  readonly index: ShopContextIndex
}

export class ShopContextError extends Error {}

function missing(kind: string, key: string, available: string[]): ShopContextError {
  const list = available.length ? available.join(', ') : '(none returned by the shop)'
  return new ShopContextError(`${kind} '${key}' not found. Available: ${list}.`)
}

function requireDefault<T>(value: T | null, kind: string): T {
  if (value === null || value === undefined) {
    throw new ShopContextError(`The shop returned no ${kind}, so there is no default to use.`)
  }
  return value
}

function lookupId(shop: ShopContext, resolve: (shop: ShopContext) => ShopContextRecord): string {
  return resolve(shop).id
}

function findCurrency(shop: ShopContext, isoCode: string): ShopContextCurrency {
  const found = shop.index.currencyByIso.get(isoCode.toUpperCase())
  if (!found) throw missing('currency', isoCode, [...shop.index.currencyByIso.keys()])
  return found
}

function findLanguage(shop: ShopContext, locale: string): ShopContextLanguage {
  const found = shop.index.languageByLocale.get(locale)
  if (!found) throw missing('language', locale, [...shop.index.languageByLocale.keys()])
  return found
}

function findSalesChannel(shop: ShopContext, name: string): ShopContextSalesChannel {
  const found = shop.index.salesChannelByName.get(name)
  if (!found) throw missing('salesChannel', name, [...shop.index.salesChannelByName.keys()])
  return found
}

function findCountry(shop: ShopContext, iso: string): ShopContextCountry {
  const found = shop.index.countryByIso.get(iso.toUpperCase())
  if (!found) throw missing('country', iso, [...shop.index.countryByIso.keys()])
  return found
}

function findSalutation(shop: ShopContext, key: string): ShopContextSalutation {
  const found = shop.index.salutationByKey.get(key)
  if (!found) throw missing('salutation', key, [...shop.index.salutationByKey.keys()])
  return found
}

function findState(
  shop: ShopContext,
  machine: string,
  technicalName: string,
): ShopContextStateMachineState {
  const found = shop.index.stateByMachineState.get(`${machine}::${technicalName}`)
  if (!found) {
    const states = shop.stateMachineStates
      .filter((s) => s.machineTechnicalName === machine)
      .map((s) => s.technicalName)
    const hint = states.length ? states.join(', ') : `(machine '${machine}' not found)`
    throw new ShopContextError(
      `stateMachineState('${machine}', '${technicalName}') not found. States for '${machine}': ${hint}.`,
    )
  }
  return found
}

function findTax(shop: ShopContext, rate: number): ShopContextTax {
  const found = shop.index.taxByRate.get(rate)
  if (!found) throw missing('tax', String(rate), [...shop.index.taxByRate.keys()].map(String))
  return found
}

function findPaymentMethod(shop: ShopContext, technicalName: string): ShopContextPaymentMethod {
  const found = shop.index.paymentMethodByTechnicalName.get(technicalName)
  if (!found) {
    throw missing('paymentMethod', technicalName, [
      ...shop.index.paymentMethodByTechnicalName.keys(),
    ])
  }
  return found
}

function findShippingMethod(shop: ShopContext, technicalName: string): ShopContextShippingMethod {
  const found = shop.index.shippingMethodByTechnicalName.get(technicalName)
  if (!found) {
    throw missing('shippingMethod', technicalName, [
      ...shop.index.shippingMethodByTechnicalName.keys(),
    ])
  }
  return found
}

function findMediaFolder(shop: ShopContext, entity: string): ShopContextMediaFolder {
  const found = shop.index.mediaFolderByEntity.get(entity)
  if (!found) throw missing('mediaFolder', entity, [...shop.index.mediaFolderByEntity.keys()])
  return found
}

export interface Shop {
  context(): ShopContext
  readonly extensions: ShopContextExtensions

  readonly defaultCurrency: ShopToken
  readonly defaultLanguage: ShopToken
  readonly defaultSalesChannel: ShopToken
  readonly defaultCountry: ShopToken
  readonly defaultSalutation: ShopToken
  readonly defaultTax: ShopToken
  readonly defaultPaymentMethod: ShopToken
  readonly defaultShippingMethod: ShopToken

  readonly defaultTaxRate: ShopValueToken<number>

  currency(isoCode: string): ShopToken
  language(locale: string): ShopToken
  salesChannel(name: string): ShopToken
  country(iso: string): ShopToken
  salutation(key: string): ShopToken
  tax(rate: number): ShopToken
  taxRate(rate: number): ShopValueToken<number>
  paymentMethod(technicalName: string): ShopToken
  shippingMethod(technicalName: string): ShopToken
  stateMachineState(machine: string, technicalName: string): ShopToken
  orderState(technicalName: string): ShopToken
  orderDeliveryState(technicalName: string): ShopToken
  orderTransactionState(technicalName: string): ShopToken
  mediaFolder(entity?: string): ShopToken
}

const tokens = {
  defaultCurrency: shopToken('defaultCurrency', (s) => s.index.currencyDefault.id),
  defaultLanguage: shopToken('defaultLanguage', (s) => s.index.languageDefault.id),
  defaultSalesChannel: shopToken('defaultSalesChannel', (s) => s.index.salesChannelDefault.id),
  defaultCountry: shopToken(
    'defaultCountry',
    (s) => requireDefault(s.index.countryDefault, 'countries').id,
  ),
  defaultSalutation: shopToken(
    'defaultSalutation',
    (s) => requireDefault(s.index.salutationDefault, 'salutations').id,
  ),
  defaultTax: shopToken('defaultTax', (s) => requireDefault(s.index.taxDefault, 'taxes').id),
  defaultPaymentMethod: shopToken(
    'defaultPaymentMethod',
    (s) => requireDefault(s.index.paymentMethodDefault, 'payment methods').id,
  ),
  defaultShippingMethod: shopToken(
    'defaultShippingMethod',
    (s) => requireDefault(s.index.shippingMethodDefault, 'shipping methods').id,
  ),
}

let activeContext: ShopContext | undefined

export function setActiveShopContext(ctx: ShopContext | undefined): void {
  activeContext = ctx
}

function requireActiveContext(): ShopContext {
  if (!activeContext) {
    throw new ShopContextError(
      'shop.context()/shop.extensions are only available while resolving definitions.',
    )
  }
  return activeContext
}

export const shop: Shop = {
  context: () => requireActiveContext(),
  get extensions() {
    return requireActiveContext().extensions
  },
  defaultCurrency: tokens.defaultCurrency,
  defaultLanguage: tokens.defaultLanguage,
  defaultSalesChannel: tokens.defaultSalesChannel,
  defaultCountry: tokens.defaultCountry,
  defaultSalutation: tokens.defaultSalutation,
  defaultTax: tokens.defaultTax,
  defaultPaymentMethod: tokens.defaultPaymentMethod,
  defaultShippingMethod: tokens.defaultShippingMethod,
  defaultTaxRate: shopValueToken(
    'defaultTaxRate',
    (s) => requireDefault(s.index.taxDefault, 'taxes').taxRate,
  ),
  currency: (iso) =>
    shopToken(`currency:${iso.toUpperCase()}`, (s) => lookupId(s, (x) => findCurrency(x, iso))),
  language: (locale) =>
    shopToken(`language:${locale}`, (s) => lookupId(s, (x) => findLanguage(x, locale))),
  salesChannel: (name) =>
    shopToken(`salesChannel:${name}`, (s) => lookupId(s, (x) => findSalesChannel(x, name))),
  country: (iso) =>
    shopToken(`country:${iso.toUpperCase()}`, (s) => lookupId(s, (x) => findCountry(x, iso))),
  salutation: (key) =>
    shopToken(`salutation:${key}`, (s) => lookupId(s, (x) => findSalutation(x, key))),
  tax: (rate) => shopToken(`tax:${rate}`, (s) => lookupId(s, (x) => findTax(x, rate))),
  taxRate: (rate) => shopValueToken(`taxRate:${rate}`, (s) => findTax(s, rate).taxRate),
  paymentMethod: (tn) =>
    shopToken(`paymentMethod:${tn}`, (s) => lookupId(s, (x) => findPaymentMethod(x, tn))),
  shippingMethod: (tn) =>
    shopToken(`shippingMethod:${tn}`, (s) => lookupId(s, (x) => findShippingMethod(x, tn))),
  stateMachineState: (machine, tn) =>
    shopToken(`state:${machine}:${tn}`, (s) => lookupId(s, (x) => findState(x, machine, tn))),
  orderState: (tn) =>
    shopToken(`state:order.state:${tn}`, (s) =>
      lookupId(s, (x) => findState(x, 'order.state', tn)),
    ),
  orderDeliveryState: (tn) =>
    shopToken(`state:order_delivery.state:${tn}`, (s) =>
      lookupId(s, (x) => findState(x, 'order_delivery.state', tn)),
    ),
  orderTransactionState: (tn) =>
    shopToken(`state:order_transaction.state:${tn}`, (s) =>
      lookupId(s, (x) => findState(x, 'order_transaction.state', tn)),
    ),
  mediaFolder: (entity = 'product') =>
    shopToken(`mediaFolder:${entity}`, (s) => lookupId(s, (x) => findMediaFolder(x, entity))),
}

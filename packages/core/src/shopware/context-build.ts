import type { ShopContext, ShopContextData, ShopContextIndex } from '../contract/shop-context'
import { ShopwareConnectionError } from './errors'

export function emptyData(): ShopContextData {
  return {
    currencies: [],
    languages: [],
    salesChannels: [],
    countries: [],
    salutations: [],
    stateMachineStates: [],
    taxes: [],
    paymentMethods: [],
    shippingMethods: [],
    mediaFolders: [],
    extensions: {},
  }
}

function required<T>(values: T[], entity: string): NonNullable<T> {
  const [first] = values
  if (first === undefined || first === null) {
    throw new ShopwareConnectionError(`Shopware returned no ${entity}.`)
  }
  return first
}

interface ShopDefaults {
  salesChannel: ShopContextData['salesChannels'][number]
  language: ShopContextData['languages'][number]
  currency: ShopContextData['currencies'][number]
  country: ShopContextData['countries'][number] | null
}

function resolveDefaults(data: ShopContextData): ShopDefaults {
  const salesChannel =
    data.salesChannels.find((s) => s.active) ?? required(data.salesChannels, 'sales channels')
  const language =
    data.languages.find((l) => l.id === salesChannel.languageId) ??
    required(data.languages, 'languages')
  const currency =
    data.currencies.find((c) => c.isSystemDefault) ??
    data.currencies.find((c) => c.id === salesChannel.currencyId) ??
    required(data.currencies, 'currencies')
  const country =
    data.countries.find((c) => c.id === salesChannel.countryId) ?? data.countries[0] ?? null
  return { salesChannel, language, currency, country }
}

function highestTax(taxes: ShopContextData['taxes']): ShopContextData['taxes'][number] | null {
  return taxes.reduce<ShopContextData['taxes'][number] | null>(
    (best, t) => (best === null || t.taxRate > best.taxRate ? t : best),
    null,
  )
}

export function buildShopContextIndex(data: ShopContextData): ShopContextIndex {
  const defaults = resolveDefaults(data)
  return {
    currencyByIso: new Map(data.currencies.map((c) => [c.isoCode.toUpperCase(), c])),
    currencyDefault: defaults.currency,
    languageByLocale: new Map(data.languages.map((l) => [l.locale, l])),
    languageDefault: defaults.language,
    salesChannelByName: new Map(data.salesChannels.map((s) => [s.name, s])),
    salesChannelDefault: defaults.salesChannel,
    countryByIso: new Map(data.countries.map((c) => [c.iso.toUpperCase(), c])),
    countryDefault: defaults.country,
    salutationByKey: new Map(data.salutations.map((s) => [s.salutationKey, s])),
    salutationDefault: data.salutations[0] ?? null,
    stateByMachineState: new Map(
      data.stateMachineStates.map((s) => [`${s.machineTechnicalName}::${s.technicalName}`, s]),
    ),
    taxByRate: new Map(data.taxes.map((t) => [t.taxRate, t])),
    taxDefault: highestTax(data.taxes),
    paymentMethodByTechnicalName: new Map(data.paymentMethods.map((p) => [p.technicalName, p])),
    paymentMethodDefault: data.paymentMethods[0] ?? null,
    shippingMethodByTechnicalName: new Map(data.shippingMethods.map((s) => [s.technicalName, s])),
    shippingMethodDefault: data.shippingMethods[0] ?? null,
    mediaFolderByEntity: new Map(data.mediaFolders.map((f) => [f.entity, f])),
  }
}

export function toShopContext(data: ShopContextData): ShopContext {
  const defaults = resolveDefaults(data)
  const normalized: ShopContextData = {
    ...data,
    languages: data.languages.map((l) => ({ ...l, isSystem: l.id === defaults.language.id })),
  }
  return { ...normalized, index: buildShopContextIndex(normalized) }
}

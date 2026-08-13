import { z } from 'zod'
import type { ShopContextData } from '../contract/shop-context'
import type { ShopwareClient } from './client'
import { ShopwareConnectionError } from './errors'
import { searchAll, unwrapRows } from './search'

export interface ShopContextFetcher {
  readonly entity: string
  fetch(client: ShopwareClient): Promise<unknown>
  merge(data: ShopContextData, result: unknown): void
}

export function parseRows<T>(entity: string, schema: z.ZodType<T>, rows: unknown): T[] {
  const result = z.array(schema).safeParse(rows ?? [])
  if (!result.success) {
    throw new ShopwareConnectionError(
      `Shopware returned an unexpected response shape for ${entity}.`,
    )
  }
  return result.data
}

const currencyRow = z.object({
  id: z.string(),
  name: z.string(),
  isoCode: z.string(),
  isSystemDefault: z.boolean().nullish(),
})
const languageRow = z.object({
  id: z.string(),
  name: z.string(),
  locale: z.object({ code: z.string().optional() }).nullish(),
})
const salesChannelRow = z.object({
  id: z.string(),
  name: z.string(),
  typeId: z.string(),
  currencyId: z.string(),
  languageId: z.string(),
  countryId: z.string().nullish(),
  active: z.boolean().nullish(),
})
const countryRow = z.object({
  id: z.string(),
  name: z.string(),
  iso: z.string().nullish(),
  iso3: z.string().nullish(),
})
const salutationRow = z.object({
  id: z.string(),
  salutationKey: z.string(),
  displayName: z.string().nullish(),
})
const stateRow = z.object({
  id: z.string(),
  name: z.string(),
  technicalName: z.string(),
  stateMachine: z.object({ technicalName: z.string().optional() }).nullish(),
})
const taxRow = z.object({
  id: z.string(),
  name: z.string(),
  taxRate: z.number(),
})
const paymentMethodRow = z.object({
  id: z.string(),
  name: z.string(),
  technicalName: z.string().nullish(),
})
const shippingMethodRow = z.object({
  id: z.string(),
  name: z.string(),
  technicalName: z.string().nullish(),
})
const mediaFolderRow = z.object({
  id: z.string(),
  name: z.string().nullish(),
  defaultFolder: z.object({ entity: z.string() }).nullish(),
})

export const BUILT_IN_FETCHERS: ShopContextFetcher[] = [
  {
    entity: 'currencies',
    fetch: (c) => searchAll(c, 'searchCurrency post /search/currency', {}),
    merge: (data, raw) => {
      data.currencies = parseRows('currencies', currencyRow, unwrapRows(raw)).map((r) => ({
        id: r.id,
        name: r.name,
        isoCode: r.isoCode,
        isSystemDefault: r.isSystemDefault ?? false,
      }))
    },
  },
  {
    entity: 'languages',
    fetch: (c) =>
      searchAll(c, 'searchLanguage post /search/language', {
        associations: { locale: {} },
      }),
    merge: (data, raw) => {
      data.languages = parseRows('languages', languageRow, unwrapRows(raw))
        .filter((r) => r.locale?.code)
        .map((r) => ({
          id: r.id,
          name: r.name,
          locale: r.locale?.code as string,
          isSystem: false,
        }))
    },
  },
  {
    entity: 'sales channels',
    fetch: (c) => searchAll(c, 'searchSalesChannel post /search/sales-channel', {}),
    merge: (data, raw) => {
      data.salesChannels = parseRows('sales channels', salesChannelRow, unwrapRows(raw)).map(
        (r) => ({
          id: r.id,
          name: r.name,
          typeId: r.typeId,
          currencyId: r.currencyId,
          languageId: r.languageId,
          countryId: r.countryId ?? null,
          active: r.active ?? true,
        }),
      )
    },
  },
  {
    entity: 'countries',
    fetch: (c) => searchAll(c, 'searchCountry post /search/country', {}),
    merge: (data, raw) => {
      data.countries = parseRows('countries', countryRow, unwrapRows(raw))
        .filter((r) => r.iso)
        .map((r) => ({ id: r.id, name: r.name, iso: r.iso as string, iso3: r.iso3 ?? '' }))
    },
  },
  {
    entity: 'salutations',
    fetch: (c) => searchAll(c, 'searchSalutation post /search/salutation', {}),
    merge: (data, raw) => {
      data.salutations = parseRows('salutations', salutationRow, unwrapRows(raw)).map((r) => ({
        id: r.id,
        name: r.displayName ?? r.salutationKey,
        salutationKey: r.salutationKey,
        displayName: r.displayName ?? r.salutationKey,
      }))
    },
  },
  {
    entity: 'state machine states',
    fetch: (c) =>
      searchAll(c, 'searchStateMachineState post /search/state-machine-state', {
        associations: { stateMachine: {} },
      }),
    merge: (data, raw) => {
      data.stateMachineStates = parseRows('state machine states', stateRow, unwrapRows(raw))
        .filter((r) => r.stateMachine?.technicalName)
        .map((r) => ({
          id: r.id,
          name: r.name,
          technicalName: r.technicalName,
          machineTechnicalName: r.stateMachine?.technicalName as string,
        }))
    },
  },
  {
    entity: 'taxes',
    fetch: (c) => searchAll(c, 'searchTax post /search/tax', {}),
    merge: (data, raw) => {
      data.taxes = parseRows('taxes', taxRow, unwrapRows(raw))
    },
  },
  {
    entity: 'payment methods',
    fetch: (c) => searchAll(c, 'searchPaymentMethod post /search/payment-method', {}),
    merge: (data, raw) => {
      data.paymentMethods = parseRows('payment methods', paymentMethodRow, unwrapRows(raw))
        .filter((r) => r.technicalName)
        .map((r) => ({ id: r.id, name: r.name, technicalName: r.technicalName as string }))
    },
  },
  {
    entity: 'shipping methods',
    fetch: (c) => searchAll(c, 'searchShippingMethod post /search/shipping-method', {}),
    merge: (data, raw) => {
      data.shippingMethods = parseRows('shipping methods', shippingMethodRow, unwrapRows(raw))
        .filter((r) => r.technicalName)
        .map((r) => ({ id: r.id, name: r.name, technicalName: r.technicalName as string }))
    },
  },
  {
    entity: 'media folders',
    fetch: (c) =>
      searchAll(c, 'searchMediaFolder post /search/media-folder', {
        associations: { defaultFolder: {} },
      }),
    merge: (data, raw) => {
      data.mediaFolders = parseRows('media folders', mediaFolderRow, unwrapRows(raw))
        .filter((r) => r.defaultFolder?.entity)
        .map((r) => ({
          id: r.id,
          name: r.name ?? (r.defaultFolder?.entity as string),
          entity: r.defaultFolder?.entity as string,
        }))
    },
  },
]

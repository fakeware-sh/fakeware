import { z } from 'zod'
import type { ShopContextData } from '../contract/shop-context'
import type { ShopwareClient } from './client'
import { ShopwareConnectionError } from './errors'

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

export function rowsOf(raw: unknown): unknown {
  let value = raw
  while (value && typeof value === 'object' && !Array.isArray(value) && 'data' in value) {
    value = (value as { data?: unknown }).data
  }
  return value ?? []
}

export function totalOf(raw: unknown): number | undefined {
  let value = raw
  while (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as { total?: unknown; data?: unknown }
    if (typeof record.total === 'number') return record.total
    if (!('data' in record)) break
    value = record.data
  }
  return undefined
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

type PageFetcher = (
  client: ShopwareClient,
  operation: string,
  body: Record<string, unknown>,
) => Promise<{ data: unknown[] }>

export function builtInFetchers(fetchAllPages: PageFetcher): ShopContextFetcher[] {
  return [
    {
      entity: 'currencies',
      fetch: (c) => fetchAllPages(c, 'searchCurrency post /search/currency', {}),
      merge: (data, raw) => {
        data.currencies = parseRows('currencies', currencyRow, rowsOf(raw)).map((r) => ({
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
        fetchAllPages(c, 'searchLanguage post /search/language', {
          associations: { locale: {} },
        }),
      merge: (data, raw) => {
        data.languages = parseRows('languages', languageRow, rowsOf(raw))
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
      fetch: (c) => fetchAllPages(c, 'searchSalesChannel post /search/sales-channel', {}),
      merge: (data, raw) => {
        data.salesChannels = parseRows('sales channels', salesChannelRow, rowsOf(raw)).map((r) => ({
          id: r.id,
          name: r.name,
          typeId: r.typeId,
          currencyId: r.currencyId,
          languageId: r.languageId,
          countryId: r.countryId ?? null,
          active: r.active ?? true,
        }))
      },
    },
    {
      entity: 'countries',
      fetch: (c) => fetchAllPages(c, 'searchCountry post /search/country', {}),
      merge: (data, raw) => {
        data.countries = parseRows('countries', countryRow, rowsOf(raw))
          .filter((r) => r.iso)
          .map((r) => ({ id: r.id, name: r.name, iso: r.iso as string, iso3: r.iso3 ?? '' }))
      },
    },
    {
      entity: 'salutations',
      fetch: (c) => fetchAllPages(c, 'searchSalutation post /search/salutation', {}),
      merge: (data, raw) => {
        data.salutations = parseRows('salutations', salutationRow, rowsOf(raw)).map((r) => ({
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
        fetchAllPages(c, 'searchStateMachineState post /search/state-machine-state', {
          associations: { stateMachine: {} },
        }),
      merge: (data, raw) => {
        data.stateMachineStates = parseRows('state machine states', stateRow, rowsOf(raw))
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
      fetch: (c) => fetchAllPages(c, 'searchTax post /search/tax', {}),
      merge: (data, raw) => {
        data.taxes = parseRows('taxes', taxRow, rowsOf(raw))
      },
    },
    {
      entity: 'payment methods',
      fetch: (c) => fetchAllPages(c, 'searchPaymentMethod post /search/payment-method', {}),
      merge: (data, raw) => {
        data.paymentMethods = parseRows('payment methods', paymentMethodRow, rowsOf(raw))
          .filter((r) => r.technicalName)
          .map((r) => ({ id: r.id, name: r.name, technicalName: r.technicalName as string }))
      },
    },
    {
      entity: 'shipping methods',
      fetch: (c) => fetchAllPages(c, 'searchShippingMethod post /search/shipping-method', {}),
      merge: (data, raw) => {
        data.shippingMethods = parseRows('shipping methods', shippingMethodRow, rowsOf(raw))
          .filter((r) => r.technicalName)
          .map((r) => ({ id: r.id, name: r.name, technicalName: r.technicalName as string }))
      },
    },
    {
      entity: 'media folders',
      fetch: (c) =>
        fetchAllPages(c, 'searchMediaFolder post /search/media-folder', {
          associations: { defaultFolder: {} },
        }),
      merge: (data, raw) => {
        data.mediaFolders = parseRows('media folders', mediaFolderRow, rowsOf(raw))
          .filter((r) => r.defaultFolder?.entity)
          .map((r) => ({
            id: r.id,
            name: r.name ?? (r.defaultFolder?.entity as string),
            entity: r.defaultFolder?.entity as string,
          }))
      },
    },
  ]
}

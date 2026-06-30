import { z } from 'zod'
import type { OwnedFetcher } from '../plugin'
import { createShopwareClient, type ShopwareClient } from './client'
import { ShopwareConnectionError } from './errors'
import { toConnectionError } from './operations'
import type { ShopContext, ShopContextData, ShopContextIndex } from './shop-context'
import type { ShopwareConnection } from './types'

const SEARCH_LIMIT = 500

export interface ShopContextFetcher {
  readonly entity: string
  fetch(client: ShopwareClient): Promise<unknown>
  merge(data: ShopContextData, result: unknown): void
}

function parseRows<T>(entity: string, schema: z.ZodType<T>, rows: unknown): T[] {
  const result = z.array(schema).safeParse(rows ?? [])
  if (!result.success) {
    throw new ShopwareConnectionError(
      `Shopware returned an unexpected response shape for ${entity}.`,
    )
  }
  return result.data
}

function rowsOf(raw: unknown): unknown {
  let value = raw
  while (value && typeof value === 'object' && !Array.isArray(value) && 'data' in value) {
    value = (value as { data?: unknown }).data
  }
  return value ?? []
}

function totalOf(raw: unknown): number | undefined {
  let value = raw
  while (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as { total?: unknown; data?: unknown }
    if (typeof record.total === 'number') return record.total
    if (!('data' in record)) break
    value = record.data
  }
  return undefined
}

async function fetchAllPages(
  client: ShopwareClient,
  operation: string,
  body: Record<string, unknown>,
): Promise<{ data: unknown[] }> {
  const collected: unknown[] = []
  let page = 1
  for (;;) {
    const raw = await client.invoke(
      operation as never,
      {
        body: { ...body, page, limit: SEARCH_LIMIT, 'total-count-mode': 1 },
      } as never,
    )
    const rows = rowsOf(raw)
    const pageRows = Array.isArray(rows) ? rows : []
    collected.push(...pageRows)
    const total = totalOf(raw)
    if (pageRows.length === 0) break
    if (total !== undefined && collected.length >= total) break
    if (total === undefined && pageRows.length < SEARCH_LIMIT) break
    page += 1
  }
  return { data: collected }
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

const BUILT_IN_FETCHERS: ShopContextFetcher[] = [
  {
    entity: 'currencies',
    fetch: (c) =>
      c.invoke('searchCurrency post /search/currency', { body: { limit: SEARCH_LIMIT } }),
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
      c.invoke('searchLanguage post /search/language', {
        body: { associations: { locale: {} }, limit: SEARCH_LIMIT },
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
    fetch: (c) =>
      c.invoke('searchSalesChannel post /search/sales-channel', { body: { limit: SEARCH_LIMIT } }),
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
    fetch: (c) => c.invoke('searchCountry post /search/country', { body: { limit: SEARCH_LIMIT } }),
    merge: (data, raw) => {
      data.countries = parseRows('countries', countryRow, rowsOf(raw))
        .filter((r) => r.iso)
        .map((r) => ({ id: r.id, name: r.name, iso: r.iso as string, iso3: r.iso3 ?? '' }))
    },
  },
  {
    entity: 'salutations',
    fetch: (c) =>
      c.invoke('searchSalutation post /search/salutation', { body: { limit: SEARCH_LIMIT } }),
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
    fetch: (c) => c.invoke('searchTax post /search/tax', { body: { limit: SEARCH_LIMIT } }),
    merge: (data, raw) => {
      data.taxes = parseRows('taxes', taxRow, rowsOf(raw))
    },
  },
  {
    entity: 'payment methods',
    fetch: (c) =>
      c.invoke('searchPaymentMethod post /search/payment-method', {
        body: { limit: SEARCH_LIMIT },
      }),
    merge: (data, raw) => {
      data.paymentMethods = parseRows('payment methods', paymentMethodRow, rowsOf(raw))
        .filter((r) => r.technicalName)
        .map((r) => ({ id: r.id, name: r.name, technicalName: r.technicalName as string }))
    },
  },
  {
    entity: 'shipping methods',
    fetch: (c) =>
      c.invoke('searchShippingMethod post /search/shipping-method', {
        body: { limit: SEARCH_LIMIT },
      }),
    merge: (data, raw) => {
      data.shippingMethods = parseRows('shipping methods', shippingMethodRow, rowsOf(raw))
        .filter((r) => r.technicalName)
        .map((r) => ({ id: r.id, name: r.name, technicalName: r.technicalName as string }))
    },
  },
]

function emptyData(): ShopContextData {
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

export async function fetchShopContext(
  connection: ShopwareConnection,
  extraFetchers: OwnedFetcher[] = [],
  client: ShopwareClient = createShopwareClient(connection),
): Promise<ShopContext> {
  const builtIn: OwnedFetcher[] = BUILT_IN_FETCHERS.map((fetcher) => ({
    plugin: '',
    fetcher,
  }))
  const fetchers = [...builtIn, ...extraFetchers]
  const data = emptyData()
  try {
    await client.invoke('infoShopwareVersion get /_info/version')
  } catch (error) {
    throw toConnectionError(connection, error)
  }
  const results = await Promise.all(
    fetchers.map(async ({ plugin, fetcher }) => {
      try {
        return await fetcher.fetch(client)
      } catch (error) {
        if (!plugin) throw toConnectionError(connection, error)
        throw new ShopwareConnectionError(
          `Plugin "${plugin}" fetcher "${fetcher.entity}" failed.`,
          { cause: error },
        )
      }
    }),
  )
  for (const [i, { fetcher }] of fetchers.entries()) {
    fetcher.merge(data, results[i])
  }
  return toShopContext(data)
}

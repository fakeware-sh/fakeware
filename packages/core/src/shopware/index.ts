export { createShopwareClient, type ShopwareClient, withRetry } from './client'
export {
  type ParsedApiError,
  ShopwareApiError,
  ShopwareConnectionError,
} from './errors'
export {
  buildShopContextIndex,
  fetchShopContext,
  type ShopContextFetcher,
  toShopContext,
} from './fetch-shop-context'
export { toApiError, toConnectionError, validateConnection } from './operations'
export {
  type Shop,
  type ShopContext,
  type ShopContextCountry,
  type ShopContextCurrency,
  type ShopContextData,
  ShopContextError,
  type ShopContextExtensions,
  type ShopContextIndex,
  type ShopContextLanguage,
  type ShopContextPaymentMethod,
  type ShopContextRecord,
  type ShopContextSalesChannel,
  type ShopContextSalutation,
  type ShopContextShippingMethod,
  type ShopContextStateMachineState,
  type ShopContextTax,
  setActiveShopContext,
  shop,
} from './shop-context'
export { createSyncSink, ENTITY_REQUEST_BYTE_LIMIT } from './sink'
export type { ShopwareConnection } from './types'

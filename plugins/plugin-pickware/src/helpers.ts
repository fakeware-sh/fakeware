import { deterministicId, type ShopValueToken, shop, shopToken } from '@fakeware/core'
import { LIVE_VERSION_ID } from '@fakeware/core/shopware'
import type {
  Id,
  PickwareBinLocationRecord,
  PickwarePrice,
  PickwareProductSupplierConfigurationInline,
  PickwareProductSupplierConfigurationRecord,
  PickwareReturnOrderLineItemRecord,
  PickwareReturnOrderRecord,
  PickwareReturnReason,
  PickwareSupplierRecord,
} from './entities'
import { warehouseIdByCode } from './fetchers'

export const RETURN_ORDER_STATE_MACHINE = 'pickware_erp_return_order.state'

export type PickwareReturnState =
  | 'requested'
  | 'announced'
  | 'partially_received'
  | 'received'
  | 'completed'
  | 'cancelled'
  | 'declined'

export const RETURN_ORDER_INITIAL_STATE: PickwareReturnState = 'requested'

function pruneUndefined<T extends Record<string, unknown>>(record: T): T {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined)) as T
}

export interface BinLocationInput {
  $key?: string
  code: string
  warehouseCode: string
  position?: number
}

export function binLocation(input: BinLocationInput): PickwareBinLocationRecord {
  return pruneUndefined({
    $key: input.$key,
    code: input.code,
    position: input.position,
    warehouseId: shopToken(`pickwareWarehouse:${input.warehouseCode}`, (s) =>
      warehouseIdByCode(s.extensions, input.warehouseCode),
    ),
  })
}

export interface SupplierInput {
  $key?: string
  number: string
  name: string
  customerNumber?: string
  languageId?: Id
}

export function supplier(input: SupplierInput): PickwareSupplierRecord {
  return pruneUndefined({
    $key: input.$key,
    number: input.number,
    name: input.name,
    customerNumber: input.customerNumber,
    languageId: input.languageId ?? shop.defaultLanguage,
  })
}

export type PickwarePriceInput = PickwarePrice | ShopValueToken<PickwarePrice>

export interface ProductSupplierConfigInput {
  $key?: string
  productId: Id
  supplierId: Id
  purchasePrices: PickwarePriceInput[]
  minPurchase?: number
  purchaseSteps?: number
  supplierIsDefault?: boolean
}

export function productSupplierConfig(
  input: ProductSupplierConfigInput,
): PickwareProductSupplierConfigurationRecord {
  return pruneUndefined({
    $key: input.$key,
    productId: input.productId,
    productVersionId: LIVE_VERSION_ID,
    supplierId: input.supplierId,
    minPurchase: input.minPurchase ?? 1,
    purchaseSteps: input.purchaseSteps ?? 1,
    purchasePrices: input.purchasePrices,
    supplierIsDefault: input.supplierIsDefault ?? true,
  })
}

export interface ProductSupplierConfigExtensionInput {
  key: string
  supplierId: Id
  purchasePrices: PickwarePriceInput[]
  minPurchase?: number
  purchaseSteps?: number
  supplierIsDefault?: boolean
}

export function productSupplierConfigExtension(
  input: ProductSupplierConfigExtensionInput,
): PickwareProductSupplierConfigurationInline {
  return pruneUndefined({
    id: deterministicId('pickware_erp_product_supplier_configuration', input.key),
    productVersionId: LIVE_VERSION_ID,
    supplierId: input.supplierId,
    minPurchase: input.minPurchase ?? 1,
    purchaseSteps: input.purchaseSteps ?? 1,
    purchasePrices: input.purchasePrices,
    supplierIsDefault: input.supplierIsDefault ?? true,
  })
}

export interface ReturnLineInput {
  name: string
  quantity: number
  position?: number
  reason?: PickwareReturnReason
  price: object
  priceDefinition: object
  productId?: Id
  orderLineItemId?: Id
}

export interface ReturnOrderInput {
  $key?: string
  number: string
  orderId: Id
  price: object
  state?: PickwareReturnState | false
  internalComment?: string
  warehouseId?: Id
  lineItems: ReturnLineInput[]
}

function returnLine(line: ReturnLineInput, index: number): PickwareReturnOrderLineItemRecord {
  return pruneUndefined({
    versionId: LIVE_VERSION_ID,
    type: 'product',
    name: line.name,
    quantity: line.quantity,
    position: line.position ?? index + 1,
    reason: line.reason ?? 'other',
    priceDefinition: line.priceDefinition,
    price: line.price,
    productId: line.productId,
    productVersionId: line.productId ? LIVE_VERSION_ID : undefined,
    orderLineItemId: line.orderLineItemId,
    orderLineItemVersionId: line.orderLineItemId ? LIVE_VERSION_ID : undefined,
  })
}

export function returnOrder(input: ReturnOrderInput): PickwareReturnOrderRecord {
  return pruneUndefined({
    $key: input.$key,
    versionId: LIVE_VERSION_ID,
    number: input.number,
    stateId:
      input.state === false
        ? undefined
        : shop.stateMachineState(
            RETURN_ORDER_STATE_MACHINE,
            input.state ?? RETURN_ORDER_INITIAL_STATE,
          ),
    orderId: input.orderId,
    orderVersionId: LIVE_VERSION_ID,
    price: input.price,
    internalComment: input.internalComment,
    warehouseId: input.warehouseId,
    lineItems: input.lineItems.map(returnLine),
  })
}

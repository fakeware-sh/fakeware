import type { AnyToken, ShopValueToken } from '@fakeware/core'

export const PICKWARE_LIVE_VERSION = '0fa91ce3e96a4bc2be4bd9ce752c3425'

export type Id = string | AnyToken

export interface PickwareBinLocationRecord {
  $key?: string
  code: string
  warehouseId: Id
  position?: number
}

export interface PickwareSupplierRecord {
  $key?: string
  number: string
  name: string
  languageId: Id
  customerNumber?: string
}

export interface PickwarePrice {
  currencyId: Id
  gross: number
  net: number
  linked: boolean
}

export interface PickwareProductSupplierConfigurationRecord {
  $key?: string
  productId: Id
  productVersionId?: string
  supplierId: Id
  minPurchase: number
  purchaseSteps: number
  purchasePrices: (PickwarePrice | ShopValueToken<PickwarePrice>)[]
  supplierIsDefault: boolean
}

export type PickwareProductSupplierConfigurationInline = Omit<
  PickwareProductSupplierConfigurationRecord,
  'productId'
> & { id?: string }

export type PickwareReturnReason = 'wrong_item' | 'defective' | 'other'

export interface PickwareReturnOrderLineItemRecord {
  $key?: string
  versionId?: string
  type?: string
  name: string
  quantity: number
  position: number
  reason: PickwareReturnReason
  priceDefinition: object
  price: object
  productId?: Id
  productVersionId?: string
  orderLineItemId?: Id
  orderLineItemVersionId?: string
}

export interface PickwareReturnOrderRecord {
  $key?: string
  versionId?: string
  number: string
  stateId?: Id
  orderId: Id
  orderVersionId?: string
  price: object
  shippingCosts?: object
  internalComment?: string
  warehouseId?: Id
  lineItems: PickwareReturnOrderLineItemRecord[]
}

declare module '@fakeware/core' {
  interface EntityRegistry {
    pickware_erp_bin_location: PickwareBinLocationRecord
    pickware_erp_supplier: PickwareSupplierRecord
    pickware_erp_product_supplier_configuration: PickwareProductSupplierConfigurationRecord
    pickware_erp_return_order: PickwareReturnOrderRecord
    pickware_erp_return_order_line_item: PickwareReturnOrderLineItemRecord
  }
  interface RecordExtensions {
    pickwareErpProductSupplierConfigurations: PickwareProductSupplierConfigurationInline[]
  }
}

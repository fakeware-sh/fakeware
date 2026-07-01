import type { Ctx } from '../define/ctx'
import type { AnyToken } from '../define/tokens'
import { price } from '../shopware/price'
import { shop } from '../shopware/shop-context'
import { type AssocIds, assocIds } from './local-ids'

type Id = string | AnyToken

function pruneUndefined<T extends Record<string, unknown>>(record: T): T {
  for (const key of Object.keys(record)) {
    if (record[key] === undefined) delete record[key]
  }
  return record
}

export interface AddressInput {
  firstName?: string
  lastName?: string
  street?: string
  zipcode?: string
  city?: string
  salutationId?: Id
  countryId?: Id
}

export interface AddressRecord extends AddressInput {
  id: string
}

export interface ProductLineInput {
  product: Id
  label: string
  unitPrice: number
  quantity?: number
  productNumber?: string
}

export interface LineItemRecord {
  id: string
  identifier: Id
  referencedId: Id
  productId: Id
  type: 'product'
  label: string
  quantity: number
  position: number
  price: ReturnType<typeof price.calculated>
  priceDefinition: { type: 'quantity'; price: number; quantity: number; taxRules: never[] }
  payload?: { productNumber: string }
}

export interface DeliveryInput {
  ship: AddressRecord
  method: Id
  cost?: number
  earliest?: string
  latest?: string
  stateId?: Id
}

export interface DeliveryRecord {
  id: string
  stateId: Id
  shippingMethodId: Id
  shippingOrderAddress: AddressRecord
  shippingDateEarliest?: string
  shippingDateLatest?: string
  shippingCosts: ReturnType<typeof price.calculated>
}

export interface PaymentInput {
  method: Id
  amount: number
  stateId?: Id
}

export interface TransactionRecord {
  id: string
  stateId: Id
  paymentMethodId: Id
  amount: ReturnType<typeof price.calculated>
}

export interface OrderInput {
  orderNumber: string
  tax?: number
  billing: AddressRecord
  lineItems: LineItemRecord[]
  deliveries?: DeliveryRecord[]
  payment?: TransactionRecord
  shippingCost?: number
  [key: string]: unknown
}

const DEFAULT_TAX = 19

function makeBuilders(ids: AssocIds) {
  function address(input: AddressInput = {}): AddressRecord {
    return pruneUndefined({ ...input, id: ids.next('address') })
  }

  const lineItems = {
    products(items: ProductLineInput[], tax = DEFAULT_TAX): LineItemRecord[] {
      return items.map((item, i) => {
        const quantity = item.quantity ?? 1
        return pruneUndefined({
          id: ids.next('lineItem'),
          identifier: item.product,
          referencedId: item.product,
          productId: item.product,
          type: 'product' as const,
          label: item.label,
          quantity,
          position: i + 1,
          price: price.calculated(item.unitPrice, tax, { qty: quantity }),
          priceDefinition: {
            type: 'quantity' as const,
            price: item.unitPrice,
            quantity,
            taxRules: [],
          },
          payload: item.productNumber ? { productNumber: item.productNumber } : undefined,
        })
      })
    },
  }

  function delivery(input: DeliveryInput, tax = DEFAULT_TAX): DeliveryRecord {
    const cost = input.cost ?? 0
    return pruneUndefined({
      id: ids.next('delivery'),
      stateId: input.stateId ?? shop.orderDeliveryState('open'),
      shippingMethodId: input.method,
      shippingOrderAddress: { ...input.ship, id: ids.next('delivery.shippingAddr') },
      shippingDateEarliest: input.earliest,
      shippingDateLatest: input.latest,
      shippingCosts: price.calculated(cost, tax),
    })
  }

  function payment(input: PaymentInput, tax = DEFAULT_TAX): TransactionRecord {
    return pruneUndefined({
      id: ids.next('transaction'),
      stateId: input.stateId ?? shop.orderTransactionState('open'),
      paymentMethodId: input.method,
      amount: price.calculated(input.amount, tax),
    })
  }

  function order(input: OrderInput): Record<string, unknown> {
    const {
      billing,
      lineItems: items,
      deliveries,
      payment: transaction,
      shippingCost,
      tax = DEFAULT_TAX,
      ...rest
    } = input
    const positions = items.reduce((sum, li) => sum + li.price.totalPrice, 0)
    const shipping = shippingCost ?? 0
    return pruneUndefined({
      ...rest,
      stateId: (rest.stateId as Id) ?? shop.orderState('open'),
      price: price.cart(positions, shipping, tax),
      shippingCosts: price.calculated(shipping, tax),
      itemRounding: { decimals: 2, interval: 0.01, roundForNet: true },
      totalRounding: { decimals: 2, interval: 0.01, roundForNet: true },
      lineItems: items,
      billingAddressId: billing.id,
      addresses: [billing],
      deliveries,
      transactions: transaction ? [transaction] : undefined,
    })
  }

  return { address, lineItems, delivery, payment, order }
}

export type OrderBuilders = ReturnType<typeof makeBuilders>

export function builders(ctx: Pick<Ctx, 'seed'>): OrderBuilders {
  return makeBuilders(assocIds(ctx))
}

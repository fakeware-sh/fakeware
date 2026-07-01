import type { ShopToken } from '../define/tokens'
import { shop } from './shop-context'

function round(value: number): number {
  return Number(value.toFixed(2))
}

function netFromGross(gross: number, taxRate: number): number {
  return round(gross / (1 + taxRate / 100))
}

interface CalculatedTax {
  tax: number
  taxRate: number
  price: number
}

interface TaxRule {
  taxRate: number
  percentage: number
}

function taxBlock(
  total: number,
  taxRate: number,
): { calculatedTaxes: CalculatedTax[]; taxRules: TaxRule[] } {
  const net = netFromGross(total, taxRate)
  return {
    calculatedTaxes: [{ tax: round(total - net), taxRate, price: total }],
    taxRules: [{ taxRate, percentage: 100 }],
  }
}

export interface GrossPriceOptions {
  tax: number
  currencyId?: string | ShopToken
}

export interface GrossPrice {
  currencyId: string | ShopToken
  gross: number
  net: number
  linked: boolean
}

export interface CalculatedPriceOptions {
  qty?: number
}

export interface CalculatedPrice {
  unitPrice: number
  quantity: number
  totalPrice: number
  calculatedTaxes: CalculatedTax[]
  taxRules: TaxRule[]
  referencePrice: null
  listPrice: null
}

export interface CartPrice {
  netPrice: number
  totalPrice: number
  rawTotal: number
  positionPrice: number
  taxStatus: 'gross'
  calculatedTaxes: CalculatedTax[]
  taxRules: TaxRule[]
}

function grossPrice(unit: number, options: GrossPriceOptions): GrossPrice {
  return {
    currencyId: options.currencyId ?? shop.defaultCurrency,
    gross: round(unit),
    net: netFromGross(unit, options.tax),
    linked: true,
  }
}

function calculatedPrice(
  unit: number,
  taxRate: number,
  options: CalculatedPriceOptions = {},
): CalculatedPrice {
  const quantity = options.qty ?? 1
  const total = round(unit * quantity)
  return {
    unitPrice: round(unit),
    quantity,
    totalPrice: total,
    ...taxBlock(total, taxRate),
    referencePrice: null,
    listPrice: null,
  }
}

function cartPrice(positions: number, shipping: number, taxRate: number): CartPrice {
  const positionPrice = round(positions)
  const total = round(positions + shipping)
  return {
    netPrice: netFromGross(total, taxRate),
    totalPrice: total,
    rawTotal: total,
    positionPrice,
    taxStatus: 'gross',
    ...taxBlock(total, taxRate),
  }
}

export const price = {
  gross: grossPrice,
  calculated: calculatedPrice,
  cart: cartPrice,
  net: netFromGross,
}

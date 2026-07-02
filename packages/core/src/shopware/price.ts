import {
  isShopValueToken,
  type ShopToken,
  type ShopValueToken,
  shopValueToken,
} from '../define/tokens'
import { shop } from './shop-context'

export type TaxRate = number | ShopValueToken<number>

function deferTax<T>(
  descriptor: string,
  tax: TaxRate,
  compute: (taxRate: number) => T,
): T | ShopValueToken<T> {
  if (isShopValueToken(tax)) {
    return shopValueToken(descriptor, (s) => compute(tax.resolveValue(s)))
  }
  return compute(tax)
}

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
  tax: TaxRate
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

interface GrossPriceOptionsNumeric extends GrossPriceOptions {
  tax: number
}
interface GrossPriceOptionsToken extends GrossPriceOptions {
  tax: ShopValueToken<number>
}
function grossPrice(unit: number, options: GrossPriceOptionsNumeric): GrossPrice
function grossPrice(unit: number, options: GrossPriceOptionsToken): ShopValueToken<GrossPrice>
function grossPrice(
  unit: number,
  options: GrossPriceOptions,
): GrossPrice | ShopValueToken<GrossPrice>
function grossPrice(
  unit: number,
  options: GrossPriceOptions,
): GrossPrice | ShopValueToken<GrossPrice> {
  return deferTax(`price.gross:${unit}`, options.tax, (taxRate) => ({
    currencyId: options.currencyId ?? shop.defaultCurrency,
    gross: round(unit),
    net: netFromGross(unit, taxRate),
    linked: true,
  }))
}

function calculatedPrice(
  unit: number,
  tax: number,
  options?: CalculatedPriceOptions,
): CalculatedPrice
function calculatedPrice(
  unit: number,
  tax: ShopValueToken<number>,
  options?: CalculatedPriceOptions,
): ShopValueToken<CalculatedPrice>
function calculatedPrice(
  unit: number,
  tax: TaxRate,
  options?: CalculatedPriceOptions,
): CalculatedPrice | ShopValueToken<CalculatedPrice>
function calculatedPrice(
  unit: number,
  tax: TaxRate,
  options: CalculatedPriceOptions = {},
): CalculatedPrice | ShopValueToken<CalculatedPrice> {
  const quantity = options.qty ?? 1
  const total = round(unit * quantity)
  return deferTax(`price.calculated:${unit}x${quantity}`, tax, (taxRate) => ({
    unitPrice: round(unit),
    quantity,
    totalPrice: total,
    ...taxBlock(total, taxRate),
    referencePrice: null,
    listPrice: null,
  }))
}

function cartPrice(positions: number, shipping: number, tax: number): CartPrice
function cartPrice(
  positions: number,
  shipping: number,
  tax: ShopValueToken<number>,
): ShopValueToken<CartPrice>
function cartPrice(
  positions: number,
  shipping: number,
  tax: TaxRate,
): CartPrice | ShopValueToken<CartPrice>
function cartPrice(
  positions: number,
  shipping: number,
  tax: TaxRate,
): CartPrice | ShopValueToken<CartPrice> {
  const positionPrice = round(positions)
  const total = round(positions + shipping)
  return deferTax(`price.cart:${positions}+${shipping}`, tax, (taxRate) => ({
    netPrice: netFromGross(total, taxRate),
    totalPrice: total,
    rawTotal: total,
    positionPrice,
    taxStatus: 'gross',
    ...taxBlock(total, taxRate),
  }))
}

export const price = {
  gross: grossPrice,
  calculated: calculatedPrice,
  cart: cartPrice,
  net: netFromGross,
}

import type { ShopContext } from '../shopware/shop-context'

export const TOKEN = Symbol.for('fakeware.token')

export interface RefToken {
  readonly [TOKEN]: 'ref'
  readonly entity: string
  readonly key: string
}

export interface RefIndexToken {
  readonly [TOKEN]: 'ref-index'
  readonly entity: string
  readonly index: number
}

export interface RefsToken {
  readonly [TOKEN]: 'refs'
  readonly entity: string
}

export interface PickToken {
  readonly [TOKEN]: 'pick'
  readonly entity: string
  readonly count: number | null
}

export interface ShopToken {
  readonly [TOKEN]: 'shop'
  readonly descriptor: string
  resolve(shop: ShopContext): string
}

export type ReferenceToken = RefToken | RefIndexToken | RefsToken | PickToken
export type AnyToken = ReferenceToken | ShopToken

export function isToken(value: unknown): value is AnyToken {
  return typeof value === 'object' && value !== null && TOKEN in value
}

export function isReferenceToken(value: unknown): value is ReferenceToken {
  if (!isToken(value)) return false
  const kind = value[TOKEN]
  return kind === 'ref' || kind === 'ref-index' || kind === 'refs' || kind === 'pick'
}

export function isShopToken(value: unknown): value is ShopToken {
  return isToken(value) && value[TOKEN] === 'shop'
}

export function refToken(entity: string, key: string): RefToken {
  return { [TOKEN]: 'ref', entity, key }
}

export function refIndexToken(entity: string, index: number): RefIndexToken {
  return { [TOKEN]: 'ref-index', entity, index }
}

export function refsToken(entity: string): RefsToken {
  return { [TOKEN]: 'refs', entity }
}

export function pickToken(entity: string, count: number | null = null): PickToken {
  return { [TOKEN]: 'pick', entity, count }
}

export function shopToken(descriptor: string, resolve: (shop: ShopContext) => string): ShopToken {
  return { [TOKEN]: 'shop', descriptor, resolve }
}

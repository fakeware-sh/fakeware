import type { ShopLookup } from '../shopware/shop-context'

export interface Ctx {
  index: number
  count: number
  ref(path: string): string
  refs(entity: string): string[]
  shop: ShopLookup
}

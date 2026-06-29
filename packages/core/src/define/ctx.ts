import type { ShopLookup } from '../shopware'

export interface Ctx {
  index: number
  count: number
  ref(path: string): string
  refs(entity: string): string[]
  shop: ShopLookup
}

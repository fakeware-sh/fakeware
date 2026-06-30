import type { Shop } from '../shopware/shop-context'

export interface Ctx {
  index: number
  count: number
  seed: number
  shop: Shop
}

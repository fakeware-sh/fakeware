import type { Shop } from '../contract/shop-context'

export interface Ctx {
  index: number
  count: number
  seed: number
  shop: Shop
}

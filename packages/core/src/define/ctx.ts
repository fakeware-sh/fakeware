import type { Shop } from '../contract'

export interface Ctx {
  index: number
  count: number
  seed: number
  shop: Shop
}

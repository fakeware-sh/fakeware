import type { Ctx } from '../define/ctx'
import type { AnyToken } from '../define/tokens'
import { assocIds } from './local-ids'

type MediaId = string | AnyToken

export interface ProductMediaRecord {
  id: string
  mediaId: MediaId
  position: number
}

export interface ProductCover {
  media: ProductMediaRecord[]
  coverId: string
}

function toArray(refs: MediaId | MediaId[]): MediaId[] {
  return Array.isArray(refs) ? refs : [refs]
}

function build(refs: MediaId[], ctx: Pick<Ctx, 'seed'>): ProductCover {
  if (refs.length === 0) {
    throw new Error('cover()/gallery() requires at least one media reference.')
  }
  const ids = assocIds(ctx)
  const media = refs.map((mediaId, position) => ({
    id: ids.next('productMedia'),
    mediaId,
    position,
  }))
  return { media, coverId: (media[0] as ProductMediaRecord).id }
}

export function gallery(refs: MediaId | MediaId[], ctx: Pick<Ctx, 'seed'>): ProductCover {
  return build(toArray(refs), ctx)
}

export function cover(ref: MediaId, ctx: Pick<Ctx, 'seed'>): ProductCover {
  return build([ref], ctx)
}

import { deterministicId } from '../define/ids'

const ASSOC_ENTITY = '__assoc__'

export interface AssocIds {
  next(path: string): string
}

export function assocIds(ctx: { seed: number }): AssocIds {
  let counter = 0
  return {
    next(path: string): string {
      const local = `${ctx.seed.toString(16)}:${path}:${counter++}`
      return deterministicId(ASSOC_ENTITY, local)
    },
  }
}

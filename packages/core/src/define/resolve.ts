import type { Ctx } from './ctx'
import { isPlainObject } from './is-plain-object'

export function resolveValue(value: unknown, ctx: Ctx): unknown {
  if (typeof value === 'function') {
    return resolveValue((value as (ctx: Ctx) => unknown)(ctx), ctx)
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolveValue(item, ctx))
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {}
    for (const [key, v] of Object.entries(value)) {
      if (key === '$key') continue
      out[key] = resolveValue(v, ctx)
    }
    return out
  }
  return value
}

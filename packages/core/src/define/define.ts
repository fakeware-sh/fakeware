import type { Ctx } from './ctx'
import { RefError } from './errors'
import { defineRecords, type RecordValue, staticKey } from './registry'
import type { EntityName, RecordFor, RegistryEntityName } from './schema'
import {
  type PickToken,
  pickToken,
  type RefIndexToken,
  type RefsToken,
  type RefToken,
  refIndexToken,
  refsToken,
  refToken,
} from './tokens'

type AnyEntity = EntityName | RegistryEntityName

type KeyOf<R> = R extends (...args: never[]) => unknown
  ? never
  : R extends { $key: infer K extends string }
    ? K
    : never

type KeysOf<R> = R extends readonly (infer E)[] ? KeyOf<E> : KeyOf<R>

export type KeyMap<R> = { [K in KeysOf<R>]: RefToken }

export function define<
  const E extends AnyEntity,
  const R extends RecordFor<E> | readonly RecordFor<E>[],
>(entity: E, records: R): KeyMap<R> {
  const list = (Array.isArray(records) ? records : [records]) as RecordValue[]
  defineRecords(entity, list)

  const map: Record<string, RefToken> = {}
  for (const value of list) {
    const key = staticKey(value)
    if (key === undefined) continue
    if (key in map) {
      throw new RefError(`define('${entity}', ...) has a duplicate $key '${key}'.`)
    }
    map[key] = refToken(entity, key)
  }
  return map as KeyMap<R>
}

export function many<R>(n: number, fn: (ctx: Ctx) => R): ((ctx: Ctx) => R)[] {
  return Array.from({ length: n }, () => fn)
}

export function keyed<T extends object>(
  list: readonly T[],
  keyFn: (item: T, index: number) => string,
): (T & { $key: string })[] {
  const counts = new Map<string, number>()
  return list.map((item, index) => {
    const base = keyFn(item, index)
    const seen = counts.get(base) ?? 0
    counts.set(base, seen + 1)
    const $key = seen === 0 ? base : `${base}-${seen}`
    return { ...item, $key }
  })
}

export interface RefBuilder {
  key(key: string): RefToken
  at(index: number): RefIndexToken
  pick(count?: number): PickToken
  all(): RefsToken
}

export function ref(entity: AnyEntity): RefBuilder {
  return {
    key: (key) => refToken(entity, key),
    at: (index) => refIndexToken(entity, index),
    pick: (count) => pickToken(entity, count ?? null),
    all: () => refsToken(entity),
  }
}

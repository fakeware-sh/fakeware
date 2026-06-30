import type { Ctx } from './ctx'
import { RefError } from './errors'
import { defineRecords, type RecordValue } from './registry'
import type { EntityName, RecordFor, RefPath, RegistryEntityName } from './schema'
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

export function define<const E extends EntityName | RegistryEntityName>(
  entity: E,
  records: RecordFor<E> | readonly RecordFor<E>[],
): void {
  defineRecords(entity, records as RecordValue | RecordValue[])
}

export function many<R>(n: number, fn: (ctx: Ctx) => R): R[] {
  return Array.from({ length: n }, () => fn) as unknown as R[]
}

export function ref(path: RefPath): RefToken
export function ref(entity: EntityName | RegistryEntityName, index: number): RefIndexToken
export function ref(pathOrEntity: string, index?: number): RefToken | RefIndexToken {
  if (typeof index === 'number') {
    return refIndexToken(pathOrEntity, index)
  }
  const slash = pathOrEntity.indexOf('/')
  if (slash === -1) {
    throw new RefError(`ref('${pathOrEntity}') must be of the form 'entity/key'.`)
  }
  return refToken(pathOrEntity.slice(0, slash), pathOrEntity.slice(slash + 1))
}

export function refs(entity: EntityName | RegistryEntityName): RefsToken {
  return refsToken(entity)
}

export function pick(token: RefsToken, count?: number): PickToken {
  return pickToken(token.entity, count ?? null)
}

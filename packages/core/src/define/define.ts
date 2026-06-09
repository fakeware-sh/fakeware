import type { Ctx } from './ctx'
import { RefError } from './errors'
import { defineRecords, type RecordValue, type RefIndex } from './registry'
import type { EntityName, RecordFor, RegistryEntityName } from './schema'

export function define<const E extends EntityName | RegistryEntityName>(
  entity: E,
  records: RecordFor<E> | readonly RecordFor<E>[],
): void {
  defineRecords(entity, records as RecordValue | RecordValue[])
}

export function many<R extends Record<string, unknown>>(n: number, fn: (ctx: Ctx) => R): R {
  return Array.from({ length: n }, () => fn) as unknown as R
}

let active: RefIndex | undefined

export function setActiveRefIndex(refIndex: RefIndex | undefined): void {
  active = refIndex
}

function requireActive(): RefIndex {
  if (!active) {
    throw new RefError('ref()/refs() may only be called while resolving definitions.')
  }
  return active
}

export function ref(path: string): string {
  const slash = path.indexOf('/')
  if (slash === -1) {
    throw new RefError(`ref('${path}') must be of the form 'entity/key'.`)
  }
  const entity = path.slice(0, slash)
  const key = path.slice(slash + 1)
  const id = requireActive().byEntity.get(entity)?.byKey.get(key)
  if (!id) {
    throw new RefError(`ref('${path}') does not match any defined record.`)
  }
  return id
}

export function refs(entity: string): string[] {
  const slot = requireActive().byEntity.get(entity)
  if (!slot) {
    throw new RefError(`refs('${entity}') does not match any defined entity.`)
  }
  return [...slot.all]
}

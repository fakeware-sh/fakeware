import { ShopwareApiError } from '../shopware/errors'
import { MEDIA_UPLOAD_KEY } from '../shopware/media'
import type { ShopwareSink, SinkRecord } from './sink'

export type SinkCall =
  | { op: 'write'; entity: string; ids: string[] }
  | { op: 'delete'; entity: string; ids: string[] }
  | { op: 'upload'; entity: string; ids: string[] }

export interface InMemorySinkOptions {
  failWriteOn?: string
  failDeleteOn?: string
  failUploadOn?: string
  failDeleteWhile?: (entity: string, deleted: ReadonlySet<string>) => boolean
}

export interface InMemorySink extends ShopwareSink {
  snapshot(): Map<string, Map<string, SinkRecord>>
  readonly calls: SinkCall[]
}

export function createInMemorySink(options: InMemorySinkOptions = {}): InMemorySink {
  const store = new Map<string, Map<string, SinkRecord>>()
  const calls: SinkCall[] = []
  const deleted = new Set<string>()

  function bucket(entity: string): Map<string, SinkRecord> {
    let b = store.get(entity)
    if (!b) {
      b = new Map()
      store.set(entity, b)
    }
    return b
  }

  function deleteConflict(entity: string): ShopwareApiError {
    return new ShopwareApiError(`Cannot delete ${entity}; still in use.`, {
      status: 409,
      entity,
      errors: [
        {
          code: 'FRAMEWORK__DELETE_RESTRICTED',
          detail: `${entity} is still in use.`,
          field: null,
          pointer: null,
          recordId: null,
        },
      ],
      retryable: false,
      cause: null,
    })
  }

  return {
    calls,
    async write(entity, records): Promise<void> {
      if (options.failWriteOn === entity) {
        throw new Error(`Simulated write failure for ${entity}`)
      }
      const b = bucket(entity)
      for (const record of records) b.set(record.id, record)
      calls.push({ op: 'write', entity, ids: records.map((r) => r.id) })
    },
    async delete(entity, ids): Promise<void> {
      if (options.failDeleteOn === entity || options.failDeleteWhile?.(entity, deleted)) {
        throw deleteConflict(entity)
      }
      const b = bucket(entity)
      for (const id of ids) b.delete(id)
      deleted.add(entity)
      calls.push({ op: 'delete', entity, ids: [...ids] })
    },
    async uploadMedia(records): Promise<void> {
      const uploadable = records.filter((r) => MEDIA_UPLOAD_KEY in r)
      if (uploadable.length === 0) return
      if (options.failUploadOn === 'media') {
        throw new ShopwareApiError('Simulated upload failure for media', {
          status: 400,
          entity: 'media',
          errors: [],
          retryable: false,
          cause: null,
        })
      }
      calls.push({ op: 'upload', entity: 'media', ids: uploadable.map((r) => r.id) })
    },
    snapshot() {
      return store
    },
  }
}

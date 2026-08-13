import { readFile } from 'node:fs/promises'
import { isAbsolute, resolve as resolvePath } from 'node:path'
import { MEDIA_UPLOAD_KEY, type MediaUploadSpec } from '../contract/media'
import type { MediaUploadRecord, ShopwareSink, SinkRecord } from '../domain'
import {
  adminBaseUrl,
  createShopwareClient,
  REQUEST_TIMEOUT_MS,
  type ShopwareClient,
} from './client'
import { apiError, ShopwareApiError } from './errors'
import { toApiError } from './operations'
import { type RetryOptions, withRetry } from './retry'
import type { ShopwareConnection } from './types'

export const ENTITY_REQUEST_BYTE_LIMIT = 5 * 1024 * 1024

export interface SyncSinkOptions {
  client?: ShopwareClient
  retry?: RetryOptions
}

function syncBody(entity: string, action: 'upsert' | 'delete', payload: Record<string, unknown>[]) {
  return [{ entity, action, payload }]
}

function stripUploadKey(records: SinkRecord[]): SinkRecord[] {
  if (!records.some((r) => MEDIA_UPLOAD_KEY in r)) return records
  return records.map((r) => {
    if (!(MEDIA_UPLOAD_KEY in r)) return r
    const { [MEDIA_UPLOAD_KEY]: _, ...rest } = r
    return rest as SinkRecord
  })
}

function uploadSpecOf(record: MediaUploadRecord): MediaUploadSpec | undefined {
  const spec = record[MEDIA_UPLOAD_KEY]
  return spec ? (spec as MediaUploadSpec) : undefined
}

function guardSize(entity: string, payload: Record<string, unknown>[]): void {
  const bytes = Buffer.byteLength(JSON.stringify(syncBody(entity, 'upsert', payload)), 'utf8')
  if (bytes > ENTITY_REQUEST_BYTE_LIMIT) {
    const mb = (bytes / (1024 * 1024)).toFixed(1)
    const limit = (ENTITY_REQUEST_BYTE_LIMIT / (1024 * 1024)).toFixed(0)
    throw apiError(
      `${entity} is ${mb} MB, over the ${limit} MB single-request limit. Reduce the number of ${entity} records.`,
      { entity },
    )
  }
}

export function createSyncSink(
  connection: ShopwareConnection,
  options: SyncSinkOptions = {},
): ShopwareSink {
  const client = options.client ?? createShopwareClient(connection)

  async function sync(
    entity: string,
    action: 'upsert' | 'delete',
    payload: Record<string, unknown>[],
    records: SinkRecord[],
  ): Promise<void> {
    try {
      await withRetry(
        () =>
          client.invoke('sync post /_action/sync', {
            headers: { 'indexing-behavior': 'use-queue-indexing' },
            body: syncBody(entity, action, payload) as never,
          }),
        options.retry,
      )
    } catch (error) {
      if (error instanceof ShopwareApiError) throw error
      throw toApiError(entity, records, error)
    }
  }

  async function uploadOne(
    record: MediaUploadRecord,
    spec: MediaUploadSpec,
    projectRoot: string | undefined,
  ): Promise<void> {
    const query = { extension: spec.extension, fileName: spec.fileName }
    if ('url' in spec.source) {
      await client.invoke('upload post /_action/media/{mediaId}/upload', {
        pathParams: { mediaId: record.id },
        query,
        body: { url: spec.source.url },
      } as never)
      return
    }
    const path = isAbsolute(spec.source.file)
      ? spec.source.file
      : resolvePath(projectRoot ?? process.cwd(), spec.source.file)
    const bytes = await readFile(path)
    await uploadBytes(record.id, query, bytes)
  }

  function postBytes(url: string, token: string, bytes: Uint8Array): Promise<Response> {
    return fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
      },
      body: bytes,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  }

  async function refreshedToken(): Promise<string> {
    client.setSessionData({ accessToken: '', expirationTime: 0 })
    await client.invoke('infoShopwareVersion get /_info/version')
    return client.getSessionData().accessToken
  }

  async function uploadBytes(
    mediaId: string,
    query: { extension: string; fileName: string },
    bytes: Uint8Array,
  ): Promise<void> {
    const params = new URLSearchParams({ extension: query.extension, fileName: query.fileName })
    const url = `${adminBaseUrl(connection)}/_action/media/${mediaId}/upload?${params.toString()}`
    let response = await postBytes(url, client.getSessionData().accessToken, bytes)
    if (response.status === 401) {
      response = await postBytes(url, await refreshedToken(), bytes)
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw apiError(
        `Uploading media ${mediaId} failed (HTTP ${response.status}).${detail ? ` ${detail}` : ''}`,
        {
          status: response.status,
          entity: 'media',
          retryable: response.status >= 500 || response.status === 429,
        },
      )
    }
  }

  return {
    async write(entity, records): Promise<void> {
      if (records.length === 0) return
      const payload = stripUploadKey(records)
      guardSize(entity, payload)
      await sync(entity, 'upsert', payload, payload)
    },
    async delete(entity, ids): Promise<void> {
      if (ids.length === 0) return
      await sync(
        entity,
        'delete',
        ids.map((id) => ({ id })),
        ids.map((id) => ({ id })),
      )
    },
    async uploadMedia(records, uploadOptions): Promise<void> {
      const pending = records
        .map((record) => ({ record, spec: uploadSpecOf(record) }))
        .filter((x): x is { record: MediaUploadRecord; spec: MediaUploadSpec } => x.spec != null)
      for (const { record, spec } of pending) {
        try {
          await withRetry(() => uploadOne(record, spec, uploadOptions?.projectRoot), options.retry)
        } catch (error) {
          if (error instanceof ShopwareApiError) throw error
          throw toApiError('media', [record], error)
        }
      }
    },
  }
}

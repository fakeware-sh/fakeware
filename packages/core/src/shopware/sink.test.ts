import { describe, expect, test } from 'bun:test'
import { ApiClientError } from '@shopware/api-client'
import type { ShopwareClient } from './client'
import { ShopwareApiError } from './errors'
import { createSyncSink, ENTITY_REQUEST_BYTE_LIMIT } from './sink'

const connection = { url: 'https://shop.test', clientId: 'i', clientSecret: 's' }
const noSleep = { sleep: async () => {} }

interface Invocation {
  action: string
  args: unknown
}

function recordingClient(impl?: () => Promise<unknown>): {
  client: ShopwareClient
  calls: Invocation[]
} {
  const calls: Invocation[] = []
  const client = {
    invoke: async (action: string, args: unknown) => {
      calls.push({ action, args })
      return impl ? await impl() : { data: {} }
    },
  } as unknown as ShopwareClient
  return { client, calls }
}

interface SyncArgs {
  headers: Record<string, string>
  body: { entity: string; action: string; payload: unknown[] }[]
}

function argsOf(call: Invocation): SyncArgs {
  return call.args as SyncArgs
}

function apiError(status: number, errors: unknown[] = []): ApiClientError<{ errors: never[] }> {
  return Object.assign(Object.create(ApiClientError.prototype), {
    ok: false,
    status,
    url: connection.url,
    headers: new Headers(),
    details: { errors },
  })
}

describe('createSyncSink', () => {
  test('writes one request per entity with the queue-indexing header', async () => {
    const { client, calls } = recordingClient()
    const sink = createSyncSink(connection, { client })
    await sink.write(
      'product',
      Array.from({ length: 120 }, (_, i) => ({ id: `id${i}` })),
    )

    expect(calls).toHaveLength(1)
    const args = argsOf(calls[0] as Invocation)
    expect(calls[0]?.action).toBe('sync post /_action/sync')
    expect(args.headers['indexing-behavior']).toBe('use-queue-indexing')
    expect(args.body[0]).toMatchObject({ entity: 'product', action: 'upsert' })
    expect(args.body[0]?.payload).toHaveLength(120)
  })

  test('deletes by id with the delete action', async () => {
    const { client, calls } = recordingClient()
    const sink = createSyncSink(connection, { client })
    await sink.delete('tax', ['a', 'b'])

    const op = argsOf(calls[0] as Invocation).body[0]
    expect(op?.action).toBe('delete')
    expect(op?.payload).toEqual([{ id: 'a' }, { id: 'b' }])
  })

  test('sends nothing for an empty entity', async () => {
    const { client, calls } = recordingClient()
    const sink = createSyncSink(connection, { client })
    await sink.write('tax', [])
    await sink.delete('tax', [])
    expect(calls).toHaveLength(0)
  })

  test('maps a validation failure to a structured ShopwareApiError with record ids', async () => {
    const { client } = recordingClient(() => {
      throw apiError(400, [
        { code: 'C', detail: 'must not be null', source: { pointer: '/0/price/0/gross' } },
      ])
    })
    const sink = createSyncSink(connection, { client, retry: noSleep })

    let caught: unknown
    await sink.write('product', [{ id: 'rec-0' }, { id: 'rec-1' }]).catch((e) => {
      caught = e
    })
    expect(caught).toBeInstanceOf(ShopwareApiError)
    const err = caught as ShopwareApiError
    expect(err.status).toBe(400)
    expect(err.entity).toBe('product')
    expect(err.errors[0]?.field).toBe('gross')
    expect(err.errors[0]?.recordId).toBe('rec-0')
    expect(err.retryable).toBe(false)
  })

  test('retries a 5xx then succeeds', async () => {
    let attempts = 0
    const { client } = recordingClient(async () => {
      attempts++
      if (attempts < 2) throw apiError(503)
      return { data: {} }
    })
    const sink = createSyncSink(connection, { client, retry: noSleep })
    await sink.write('tax', [{ id: 'a' }])
    expect(attempts).toBe(2)
  })

  test('does not retry a 400', async () => {
    let attempts = 0
    const { client } = recordingClient(async () => {
      attempts++
      throw apiError(400, [{ code: 'C', detail: 'bad' }])
    })
    const sink = createSyncSink(connection, { client, retry: noSleep })
    await sink.write('tax', [{ id: 'a' }]).catch(() => {})
    expect(attempts).toBe(1)
  })

  test('rejects an entity over the request size limit before sending', async () => {
    const { client, calls } = recordingClient()
    const sink = createSyncSink(connection, { client })
    const big = [{ id: 'a', blob: 'x'.repeat(ENTITY_REQUEST_BYTE_LIMIT + 1) }]
    await expect(sink.write('product', big)).rejects.toBeInstanceOf(ShopwareApiError)
    expect(calls).toHaveLength(0)
  })
})

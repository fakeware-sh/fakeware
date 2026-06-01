import { describe, expect, test } from 'bun:test'
import type { SyncOperation } from '../domain'
import type { ShopwareClient } from './client'
import { ShopwareConnectionError } from './errors'
import { createSyncSink, estimateSyncBytes } from './sink'

const connection = { url: 'https://shop.test', clientId: 'i', clientSecret: 's' }

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

function firstOp(call: Invocation): SyncArgs['body'][number] {
  const op = argsOf(call).body[0]
  if (!op) throw new Error('expected a sync operation')
  return op
}

function firstCall(calls: Invocation[]): Invocation {
  const call = calls[0]
  if (!call) throw new Error('expected at least one invocation')
  return call
}

describe('createSyncSink', () => {
  test('upserts via the sync op with the queue-indexing header', async () => {
    const { client, calls } = recordingClient()
    const sink = createSyncSink(connection, { client })
    await sink.upsert('tax', [{ id: 'a', taxRate: 19 }])

    expect(calls).toHaveLength(1)
    expect(firstCall(calls).action).toBe('sync post /_action/sync')
    expect(argsOf(firstCall(calls)).headers['indexing-behavior']).toBe('use-queue-indexing')
    expect(firstOp(firstCall(calls))).toMatchObject({ entity: 'tax', action: 'upsert' })
    expect(firstOp(firstCall(calls)).payload).toHaveLength(1)
  })

  test('batches large upserts into chunks of 50', async () => {
    const { client, calls } = recordingClient()
    const sink = createSyncSink(connection, { client })
    const records = Array.from({ length: 120 }, (_, i) => ({ id: `id${i}` }))
    await sink.upsert('product', records)

    expect(calls).toHaveLength(3)
    const sizes = calls.map((c) => firstOp(c).payload.length)
    expect(sizes).toEqual([50, 50, 20])
  })

  test('deletes by id with the delete action', async () => {
    const { client, calls } = recordingClient()
    const sink = createSyncSink(connection, { client })
    await sink.delete('tax', ['a', 'b'])

    const body = firstOp(firstCall(calls))
    expect(body.action).toBe('delete')
    expect(body.payload).toEqual([{ id: 'a' }, { id: 'b' }])
  })

  test('sends nothing for an empty batch', async () => {
    const { client, calls } = recordingClient()
    const sink = createSyncSink(connection, { client })
    await sink.upsert('tax', [])
    await sink.delete('tax', [])
    expect(calls).toHaveLength(0)
  })

  test('maps a failed request to ShopwareConnectionError', async () => {
    const { client } = recordingClient(() => {
      throw new Error('network down')
    })
    const sink = createSyncSink(connection, { client })
    await expect(sink.upsert('tax', [{ id: 'a' }])).rejects.toBeInstanceOf(ShopwareConnectionError)
  })

  test('applyAtomic sends one request holding every operation in order', async () => {
    const { client, calls } = recordingClient()
    const sink = createSyncSink(connection, { client })
    await sink.applyAtomic([
      { entity: 'tax', action: 'upsert', records: [{ id: 'a' }] },
      { entity: 'product', action: 'upsert', records: [{ id: 'p1' }, { id: 'p2' }] },
    ])

    expect(calls).toHaveLength(1)
    const call = firstCall(calls)
    expect(call.action).toBe('sync post /_action/sync')
    expect(argsOf(call).headers['indexing-behavior']).toBe('use-queue-indexing')
    expect('single-operation' in argsOf(call).headers).toBe(false)
    expect(argsOf(call).body.map((op) => op.entity)).toEqual(['tax', 'product'])
    expect(argsOf(call).body[1]?.payload).toHaveLength(2)
  })

  test('applyAtomic drops empty-payload operations and sends nothing when all are empty', async () => {
    const { client, calls } = recordingClient()
    const sink = createSyncSink(connection, { client })
    await sink.applyAtomic([{ entity: 'tax', action: 'upsert', records: [] }])
    expect(calls).toHaveLength(0)
  })

  test('applyAtomic maps a failed request to ShopwareConnectionError', async () => {
    const { client } = recordingClient(() => {
      throw new Error('boom')
    })
    const sink = createSyncSink(connection, { client })
    await expect(
      sink.applyAtomic([{ entity: 'tax', action: 'upsert', records: [{ id: 'a' }] }]),
    ).rejects.toBeInstanceOf(ShopwareConnectionError)
  })
})

describe('estimateSyncBytes', () => {
  test('grows with the payload', () => {
    const small: SyncOperation[] = [{ entity: 'tax', action: 'upsert', records: [{ id: 'a' }] }]
    const large: SyncOperation[] = [
      {
        entity: 'product',
        action: 'upsert',
        records: Array.from({ length: 100 }, (_, i) => ({ id: `id${i}`, name: 'x'.repeat(50) })),
      },
    ]
    expect(estimateSyncBytes(large)).toBeGreaterThan(estimateSyncBytes(small))
  })
})

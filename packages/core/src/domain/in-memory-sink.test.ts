import { describe, expect, test } from 'bun:test'
import { createInMemorySink } from './in-memory-sink'

describe('in-memory sink', () => {
  test('upsert is idempotent by id', async () => {
    const sink = createInMemorySink()
    await sink.upsert('tax', [{ id: 'a', rate: 19 }])
    await sink.upsert('tax', [{ id: 'a', rate: 7 }])
    expect(sink.snapshot().get('tax')?.size).toBe(1)
    expect(sink.snapshot().get('tax')?.get('a')?.rate).toBe(7)
  })

  test('delete removes ids', async () => {
    const sink = createInMemorySink()
    await sink.upsert('tax', [{ id: 'a' }, { id: 'b' }])
    await sink.delete('tax', ['a'])
    expect([...(sink.snapshot().get('tax')?.keys() ?? [])]).toEqual(['b'])
  })

  test('records every batch in the call log', async () => {
    const sink = createInMemorySink()
    await sink.upsert('tax', [{ id: 'a' }])
    await sink.delete('tax', ['a'])
    expect(sink.calls).toEqual([
      { op: 'upsert', entity: 'tax', ids: ['a'] },
      { op: 'delete', entity: 'tax', ids: ['a'] },
    ])
  })
})

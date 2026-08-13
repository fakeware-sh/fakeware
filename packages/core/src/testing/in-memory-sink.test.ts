import { describe, expect, test } from 'bun:test'
import { createInMemorySink } from './in-memory-sink'

describe('in-memory sink', () => {
  test('write is idempotent by id', async () => {
    const sink = createInMemorySink()
    await sink.write('tax', [{ id: 'a', rate: 19 }])
    await sink.write('tax', [{ id: 'a', rate: 7 }])
    expect(sink.snapshot().get('tax')?.size).toBe(1)
    expect(sink.snapshot().get('tax')?.get('a')?.rate).toBe(7)
  })

  test('delete removes ids', async () => {
    const sink = createInMemorySink()
    await sink.write('tax', [{ id: 'a' }, { id: 'b' }])
    await sink.delete('tax', ['a'])
    expect([...(sink.snapshot().get('tax')?.keys() ?? [])]).toEqual(['b'])
  })

  test('records every call in the call log', async () => {
    const sink = createInMemorySink()
    await sink.write('tax', [{ id: 'a' }])
    await sink.delete('tax', ['a'])
    expect(sink.calls).toEqual([
      { op: 'write', entity: 'tax', ids: ['a'] },
      { op: 'delete', entity: 'tax', ids: ['a'] },
    ])
  })

  test('failWriteOn throws for the named entity', async () => {
    const sink = createInMemorySink({ failWriteOn: 'product' })
    await expect(sink.write('product', [{ id: 'a' }])).rejects.toThrow()
  })
})

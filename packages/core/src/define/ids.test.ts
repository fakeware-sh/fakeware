import { describe, expect, test } from 'bun:test'
import { deterministicId, recordHash } from './ids'

describe('deterministicId', () => {
  test('is stable for the same entity and key', () => {
    expect(deterministicId('tax', 'standard')).toBe(deterministicId('tax', 'standard'))
  })

  test('differs by entity and by key', () => {
    expect(deterministicId('tax', 'standard')).not.toBe(deterministicId('product', 'standard'))
    expect(deterministicId('tax', 'standard')).not.toBe(deterministicId('tax', 'reduced'))
  })

  test('renders as 32 lowercase hex chars (Shopware id format)', () => {
    expect(deterministicId('tax', 'standard')).toMatch(/^[0-9a-f]{32}$/)
  })

  test('encodes a valid RFC 9562 UUIDv5 (version + variant bits)', () => {
    const id = deterministicId('tax', 'standard')
    expect(id.charAt(12)).toBe('5')
    expect(['8', '9', 'a', 'b']).toContain(id.charAt(16))
  })
})

describe('recordHash', () => {
  test('is independent of key ordering', () => {
    expect(recordHash({ a: 1, b: 2 })).toBe(recordHash({ b: 2, a: 1 }))
  })

  test('changes when the payload changes', () => {
    expect(recordHash({ a: 1 })).not.toBe(recordHash({ a: 2 }))
  })
})

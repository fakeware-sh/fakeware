import { describe, expect, test } from 'bun:test'
import { ApplyStopped, RefError } from '@fakeware/core'
import { ConfigError } from '@fakeware/core/config'
import { apiError } from '@fakeware/core/shopware'
import { errorKind, toJsonError } from './json-output'

describe('errorKind', () => {
  test('classifies known error types', () => {
    expect(errorKind(new ConfigError('bad'))).toBe('config')
    expect(errorKind(new RefError('bad'))).toBe('reference')
    expect(errorKind(new ApplyStopped())).toBe('applyStopped')
  })

  test('falls back to unexpected for anything else', () => {
    expect(errorKind(new Error('boom'))).toBe('unexpected')
    expect(errorKind('a string')).toBe('unexpected')
  })
})

describe('toJsonError', () => {
  test('carries the message of a plain error', () => {
    expect(toJsonError(new ConfigError('missing url'))).toEqual({
      ok: false,
      error: { kind: 'config', message: 'missing url' },
    })
  })

  test('stringifies a non-error throw', () => {
    expect(toJsonError('just a string').error.message).toBe('just a string')
  })

  test('replaces the ApplyStopped message with an explanation', () => {
    const json = toJsonError(new ApplyStopped())
    expect(json.error.kind).toBe('applyStopped')
    expect(json.error.message).toContain('nothing further was applied')
  })

  test('unpacks the status, entity and per-record details of an api error', () => {
    const error = apiError('write failed', {
      status: 400,
      entity: 'product',
      errors: [
        {
          code: 'FRAMEWORK__WRITE_CONSTRAINT',
          detail: 'This value should not be blank.',
          field: 'name',
          pointer: '/0/name',
          recordId: 'abc',
        },
      ],
    })

    expect(toJsonError(error)).toEqual({
      ok: false,
      error: {
        kind: 'shopwareApi',
        message: 'write failed',
        entity: 'product',
        status: 400,
        details: [
          {
            code: 'FRAMEWORK__WRITE_CONSTRAINT',
            detail: 'This value should not be blank.',
            field: 'name',
            recordId: 'abc',
          },
        ],
      },
    })
  })

  test('omits empty api error fields rather than emitting nulls', () => {
    const json = toJsonError(apiError('offline'))
    expect(json.error).not.toHaveProperty('entity')
    expect(json.error).not.toHaveProperty('status')
    expect(json.error).not.toHaveProperty('details')
  })

  test('includes the stack only when verbose', () => {
    expect(toJsonError(new ConfigError('x'), true).error.stack).toBeString()
    expect(toJsonError(new ConfigError('x')).error.stack).toBeUndefined()
  })

  test('survives a JSON round trip', () => {
    const json = toJsonError(apiError('boom', { status: 500, entity: 'order' }))
    expect(JSON.parse(JSON.stringify(json))).toEqual(json)
  })
})

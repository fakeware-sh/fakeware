import { describe, expect, test } from 'bun:test'
import { assertOneOf } from './validate'

describe('assertOneOf', () => {
  test('returns the value when it is allowed', () => {
    expect(assertOneOf('env', ['env', 'inline'], '--secrets')).toBe('env')
  })

  test('throws naming the flag and the allowed values when not allowed', () => {
    expect(() => assertOneOf('nope', ['env', 'inline'], '--secrets')).toThrow(
      'Invalid value for --secrets: "nope". Expected one of: env, inline',
    )
  })
})

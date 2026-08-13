import { describe, expect, test } from 'bun:test'
import { InvalidArgumentError } from 'commander'
import { assertOneOf } from './validate'

describe('assertOneOf', () => {
  test('returns the value when it is allowed', () => {
    expect(assertOneOf('env', ['env', 'inline'])).toBe('env')
  })

  test('throws an InvalidArgumentError listing the allowed values', () => {
    expect(() => assertOneOf('nope', ['env', 'inline'])).toThrow(InvalidArgumentError)
    expect(() => assertOneOf('nope', ['env', 'inline'])).toThrow('Expected one of: env, inline')
  })
})

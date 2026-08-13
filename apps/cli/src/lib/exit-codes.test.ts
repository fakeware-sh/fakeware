import { describe, expect, test } from 'bun:test'
import { EXIT_CANCELLED, EXIT_FAILURE, EXIT_OK, EXIT_USAGE } from './exit-codes'

describe('exit codes', () => {
  test('follow the documented convention', () => {
    expect(EXIT_OK).toBe(0)
    expect(EXIT_FAILURE).toBe(1)
    expect(EXIT_USAGE).toBe(2)
    expect(EXIT_CANCELLED).toBe(130)
  })
})

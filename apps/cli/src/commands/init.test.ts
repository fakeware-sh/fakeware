import { describe, expect, test } from 'bun:test'
import { findPlugins } from '../lib/plugins'
import { type InitFlags, isNonInteractive, resolvePlugins } from './init'

function flags(overrides: Partial<InitFlags> = {}): InitFlags {
  return {
    secrets: 'env',
    install: true,
    force: false,
    dryRun: false,
    ...overrides,
  }
}

describe('isNonInteractive', () => {
  test('is non-interactive when there is no TTY', () => {
    expect(isNonInteractive(flags(), false)).toBe(true)
  })

  test('is interactive on a TTY with no forcing flags', () => {
    expect(isNonInteractive(flags(), true)).toBe(false)
  })

  test('--yes forces non-interactive even on a TTY', () => {
    expect(isNonInteractive(flags({ yes: true }), true)).toBe(true)
  })

  test('all three connection flags force non-interactive on a TTY', () => {
    const connected = flags({ url: 'https://s.test', clientId: 'i', clientSecret: 's' })
    expect(isNonInteractive(connected, true)).toBe(true)
  })

  test('a partial connection does not force non-interactive on a TTY', () => {
    expect(isNonInteractive(flags({ url: 'https://s.test' }), true)).toBe(false)
  })
})

describe('resolvePlugins', () => {
  const fallback = async () => findPlugins(['pickware'])

  test('--no-plugins resolves to an empty list without calling the fallback', async () => {
    let called = false
    const result = await resolvePlugins(flags({ plugins: false }), async () => {
      called = true
      return []
    })
    expect(result).toEqual([])
    expect(called).toBe(false)
  })

  test('a plugin string is resolved via the flag parser', async () => {
    const result = await resolvePlugins(flags({ plugins: 'pickware' }), fallback)
    expect(result.map((p) => p.id)).toEqual(['pickware'])
  })

  test('"none" resolves to an empty list', async () => {
    const result = await resolvePlugins(flags({ plugins: 'none' }), fallback)
    expect(result).toEqual([])
  })

  test('falls back when no plugin flag is given', async () => {
    const result = await resolvePlugins(flags(), fallback)
    expect(result.map((p) => p.id)).toEqual(['pickware'])
  })
})

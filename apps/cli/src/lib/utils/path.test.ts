import { describe, expect, test } from 'bun:test'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { expandHome, resolveTargetDir, toValidPackageName } from './path'

describe('expandHome', () => {
  test('expands a bare tilde to the home directory', () => {
    expect(expandHome('~')).toBe(homedir())
  })

  test('expands a leading ~/ segment', () => {
    expect(expandHome('~/projects/shop')).toBe(join(homedir(), 'projects/shop'))
  })

  test('leaves a non-leading tilde untouched', () => {
    expect(expandHome('./a~b')).toBe('./a~b')
    expect(expandHome('foo/~bar')).toBe('foo/~bar')
  })
})

describe('resolveTargetDir', () => {
  test('resolves a relative path against the base', () => {
    expect(resolveTargetDir('shop', '/work')).toBe('/work/shop')
    expect(resolveTargetDir('./shop', '/work')).toBe('/work/shop')
    expect(resolveTargetDir('.', '/work')).toBe('/work')
  })

  test('passes an absolute path through unchanged', () => {
    expect(resolveTargetDir('/tmp/shop', '/work')).toBe('/tmp/shop')
  })

  test('expands home before resolving', () => {
    expect(resolveTargetDir('~/shop', '/work')).toBe(join(homedir(), 'shop'))
  })

  test('trims surrounding whitespace', () => {
    expect(resolveTargetDir('  shop  ', '/work')).toBe('/work/shop')
  })
})

describe('toValidPackageName', () => {
  test('lowercases and replaces invalid characters with dashes', () => {
    expect(toValidPackageName('My Shop')).toBe('my-shop')
    expect(toValidPackageName('Shop@2024!')).toBe('shop-2024')
  })

  test('strips leading dots/underscores and surrounding dashes', () => {
    expect(toValidPackageName('.hidden')).toBe('hidden')
    expect(toValidPackageName('_private')).toBe('private')
    expect(toValidPackageName('--edge--')).toBe('edge')
  })

  test('keeps already-valid names', () => {
    expect(toValidPackageName('my-shop-seed')).toBe('my-shop-seed')
  })

  test('falls back when nothing valid remains', () => {
    expect(toValidPackageName('!!!')).toBe('fakeware-project')
    expect(toValidPackageName('')).toBe('fakeware-project')
  })

  test('caps length at 214 characters', () => {
    expect(toValidPackageName('a'.repeat(300)).length).toBe(214)
  })
})

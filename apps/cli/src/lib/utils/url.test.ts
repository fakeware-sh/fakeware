import { describe, expect, test } from 'bun:test'
import { getProtocol, hasProtocol, normalizeShopUrl } from './url'

describe('hasProtocol', () => {
  test('true for http/https', () => {
    expect(hasProtocol('https://shop.test')).toBe(true)
    expect(hasProtocol('http://shop.test')).toBe(true)
  })

  test('false for a bare host', () => {
    expect(hasProtocol('shop.test')).toBe(false)
    expect(hasProtocol('  shop.test  ')).toBe(false)
  })
})

describe('getProtocol', () => {
  test('returns the lowercased scheme when present', () => {
    expect(getProtocol('HTTPS://shop.test')).toBe('https')
    expect(getProtocol('http://shop.test')).toBe('http')
  })

  test('undefined for a bare host', () => {
    expect(getProtocol('shop.test')).toBeUndefined()
  })
})

describe('normalizeShopUrl', () => {
  test('keeps an existing scheme and strips trailing slashes', () => {
    expect(normalizeShopUrl('https://shop.test/')).toBe('https://shop.test')
    expect(normalizeShopUrl('http://shop.test', 'https')).toBe('http://shop.test')
  })

  test('prepends the chosen protocol for a bare host', () => {
    expect(normalizeShopUrl('shop.test')).toBe('https://shop.test')
    expect(normalizeShopUrl('shop.test', 'http')).toBe('http://shop.test')
  })

  test('trims surrounding whitespace', () => {
    expect(normalizeShopUrl('  shop.test  ', 'https')).toBe('https://shop.test')
  })
})

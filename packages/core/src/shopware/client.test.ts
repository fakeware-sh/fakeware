import { describe, expect, test } from 'bun:test'
import { adminBaseUrl } from './client'
import { isConnectionConfigured } from './types'

describe('adminBaseUrl', () => {
  test('appends /api to the shop url', () => {
    expect(adminBaseUrl({ url: 'https://shop.test', clientId: 'i', clientSecret: 's' })).toBe(
      'https://shop.test/api',
    )
  })

  test('strips a trailing slash before appending', () => {
    expect(adminBaseUrl({ url: 'https://shop.test/', clientId: 'i', clientSecret: 's' })).toBe(
      'https://shop.test/api',
    )
  })
})

describe('isConnectionConfigured', () => {
  test('accepts a fully filled connection', () => {
    expect(
      isConnectionConfigured({ url: 'https://shop.test', clientId: 'i', clientSecret: 's' }),
    ).toBe(true)
  })

  test('rejects a missing connection', () => {
    expect(isConnectionConfigured(undefined)).toBe(false)
  })

  test('rejects a blank or whitespace-only field', () => {
    expect(
      isConnectionConfigured({ url: 'https://shop.test', clientId: '', clientSecret: 's' }),
    ).toBe(false)
    expect(isConnectionConfigured({ url: '  ', clientId: 'i', clientSecret: 's' })).toBe(false)
  })

  test('rejects a field left as an uninterpolated placeholder', () => {
    const placeholder = ['$', '{SHOPWARE_CLIENT_SECRET}'].join('')
    expect(
      isConnectionConfigured({
        url: 'https://shop.test',
        clientId: 'i',
        clientSecret: placeholder,
      }),
    ).toBe(false)
  })
})

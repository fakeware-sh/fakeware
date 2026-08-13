import { describe, expect, test } from 'bun:test'
import { adminBaseUrl } from './client'

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

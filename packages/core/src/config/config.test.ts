import { describe, expect, test } from 'bun:test'
import { defineConfig } from './define'
import { type FakewareUserConfig, fakewareConfigSchema } from './schema'

const validConfig: FakewareUserConfig = {
  include: ['./data/**/*.ts'],
  shopware: {
    url: 'https://my-shop.test',
    clientId: 'id',
    clientSecret: 'secret',
  },
}

describe('fakewareConfigSchema', () => {
  test('parses a minimal valid config', () => {
    const parsed = fakewareConfigSchema.parse(validConfig)
    expect(parsed.shopware?.url).toBe('https://my-shop.test')
  })

  test('rejects a config missing shopware credentials', () => {
    const result = fakewareConfigSchema.safeParse({
      include: ['./data/**/*.ts'],
      shopware: { url: '', clientId: '', clientSecret: '' },
    })
    expect(result.success).toBe(false)
  })

  test('accepts a config without shopware', () => {
    const result = fakewareConfigSchema.safeParse({ include: ['./data/**/*.ts'] })
    expect(result.success).toBe(true)
  })

  test('rejects a config without include', () => {
    const result = fakewareConfigSchema.safeParse({
      shopware: { url: 'https://my-shop.test', clientId: 'id', clientSecret: 'secret' },
    })
    expect(result.success).toBe(false)
  })

  test('rejects an empty include list', () => {
    const result = fakewareConfigSchema.safeParse({ include: [] })
    expect(result.success).toBe(false)
  })
})

describe('defineConfig', () => {
  test('returns an object config unchanged', () => {
    expect(defineConfig(validConfig)).toBe(validConfig)
  })

  test('returns a factory config unchanged and the factory is callable', () => {
    const factory = defineConfig(({ env }) => ({
      include: ['./data/**/*.ts'],
      shopware: {
        url: env.SHOPWARE_URL ?? 'https://fallback.test',
        clientId: 'id',
        clientSecret: 'secret',
      },
    }))
    const produced = factory({ env: { SHOPWARE_URL: 'https://x.test' }, mode: 'test' })
    expect(produced.shopware?.url).toBe('https://x.test')
  })
})

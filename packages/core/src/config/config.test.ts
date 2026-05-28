import { describe, expect, test } from 'bun:test'
import { defineConfig } from './define'
import { type FakewareUserConfig, fakewareConfigSchema } from './schema'

const validConfig: FakewareUserConfig = {
  shopware: {
    url: 'https://my-shop.test',
    clientId: 'id',
    clientSecret: 'secret',
  },
  locale: 'de-DE',
}

describe('fakewareConfigSchema', () => {
  test('parses a minimal valid config and fills defaults', () => {
    const parsed = fakewareConfigSchema.parse(validConfig)
    expect(parsed.shopware.url).toBe('https://my-shop.test')
    expect(parsed.batchSize).toBe(100)
    expect(parsed.generators).toEqual({})
    expect(parsed.scenarios).toEqual({})
    expect(parsed.plugins).toEqual([])
  })

  test('rejects a config missing shopware credentials', () => {
    const result = fakewareConfigSchema.safeParse({
      shopware: { url: '', clientId: '', clientSecret: '' },
    })
    expect(result.success).toBe(false)
  })

  test('rejects a config without shopware', () => {
    const result = fakewareConfigSchema.safeParse({ locale: 'de-DE' })
    expect(result.success).toBe(false)
  })

  test('accepts a scenario and per-scenario overrides', () => {
    const parsed = fakewareConfigSchema.parse({
      ...validConfig,
      scenario: 'fashion',
      scenarios: { fashion: { productCount: 1000 } },
    })
    expect(parsed.scenario).toBe('fashion')
    expect(parsed.scenarios.fashion).toEqual({ productCount: 1000 })
  })

  test('accepts plugin refs as id strings or [id, options] tuples', () => {
    const parsed = fakewareConfigSchema.parse({
      ...validConfig,
      plugins: ['@fakeware/fashion', ['@fakeware/media', { provider: 'unsplash' }]],
    })
    expect(parsed.plugins).toHaveLength(2)
  })

  test('rejects a plugin ref that is neither a string nor an [id, options] tuple', () => {
    const result = fakewareConfigSchema.safeParse({
      ...validConfig,
      plugins: [42],
    })
    expect(result.success).toBe(false)
  })
})

describe('defineConfig', () => {
  test('returns an object config unchanged', () => {
    expect(defineConfig(validConfig)).toBe(validConfig)
  })

  test('returns a factory config unchanged and the factory is callable', () => {
    const factory = defineConfig(({ env }) => ({
      shopware: {
        url: env.SHOPWARE_URL ?? 'https://fallback.test',
        clientId: 'id',
        clientSecret: 'secret',
      },
    }))
    const produced = factory({ env: { SHOPWARE_URL: 'https://x.test' }, mode: 'test' })
    expect(produced.shopware.url).toBe('https://x.test')
  })
})

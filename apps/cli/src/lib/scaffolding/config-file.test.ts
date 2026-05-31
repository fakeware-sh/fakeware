import { describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseModule } from 'magicast'
import { addToConfigFile, buildConfigFile } from './config-file'
import type { ScaffoldValues } from './values'

function configObject(source: string): Record<string, unknown> {
  return parseModule(source).exports.default.$args[0] as Record<string, unknown>
}

const base: ScaffoldValues = {
  projectName: 'demo',
  secrets: 'env',
}

describe('buildConfigFile', () => {
  test('wraps defineConfig and imports from @fakeware/core/config', () => {
    const code = buildConfigFile(base)
    expect(code).toContain("import { defineConfig } from '@fakeware/core/config'")
    expect(code).toContain('defineConfig(')
    expect(code.endsWith('\n')).toBe(true)
  })

  test('emits an env-var shopware block in env mode', () => {
    const cfg = configObject(
      buildConfigFile({ ...base, url: 'x', clientId: 'y', clientSecret: 'z' }),
    )
    const shopware = cfg.shopware as Record<string, unknown>
    expect(shopware.url).toBe('$SHOPWARE_URL')
    expect(shopware.clientId).toBe('$SHOPWARE_CLIENT_ID')
    expect(shopware.clientSecret).toBe('$SHOPWARE_CLIENT_SECRET')
  })

  test('embeds literal credentials in inline mode', () => {
    const cfg = configObject(
      buildConfigFile({
        ...base,
        secrets: 'inline',
        url: 'https://shop.test',
        clientId: 'id',
        clientSecret: 'secret',
      }),
    )
    expect((cfg.shopware as Record<string, unknown>).url).toBe('https://shop.test')
  })

  test('omits shopware when no connection is provided', () => {
    const cfg = configObject(buildConfigFile({ ...base }))
    expect(cfg.shopware).toBeUndefined()
    expect(Object.keys(cfg)).toEqual([])
  })

  test('output re-parses to a stable shape (magicast drift guard)', () => {
    const cfg = configObject(
      buildConfigFile({ ...base, url: 'x', clientId: 'y', clientSecret: 'z' }),
    )
    expect(Object.keys(cfg)).toEqual(['shopware'])
  })
})

describe('addToConfigFile', () => {
  test('injects a key into an existing config without clobbering others', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'fw-add-'))
    const path = join(dir, 'fakeware.config.ts')
    writeFileSync(path, buildConfigFile({ ...base, url: 'x', clientId: 'y', clientSecret: 'z' }))

    await addToConfigFile(path, (cfg) => {
      cfg.injected = 'abc'
    })

    const cfg = configObject(readFileSync(path, 'utf8'))
    expect(cfg.injected).toBe('abc')
    expect((cfg.shopware as Record<string, unknown>).url).toBe('$SHOPWARE_URL')
  })
})

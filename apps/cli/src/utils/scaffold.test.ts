import { describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ScaffoldError, scaffoldProject } from './scaffold'
import type { ScaffoldValues } from './templates'

function tmp(): string {
  return mkdtempSync(join(tmpdir(), 'fw-scaffold-'))
}

const values: ScaffoldValues = {
  projectName: 'my-shop-seed',
  url: 'https://my-shop.test',
  clientId: 'id',
  clientSecret: 'secret',
  locale: 'de-DE',
  secrets: 'env',
}

describe('scaffoldProject', () => {
  test('writes package.json, config, .env and .gitignore for ts + env secrets', async () => {
    const dir = tmp()
    const created = await scaffoldProject({ dir, format: 'ts', force: false, values })

    const names = created.map((f) => f.path.split('/').pop())
    expect(names).toContain('package.json')
    expect(names).toContain('fakeware.config.ts')
    expect(names).toContain('.env')
    expect(names).toContain('.gitignore')

    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
    expect(pkg.name).toBe('my-shop-seed')
    expect(pkg.private).toBe(true)
    expect(pkg.devDependencies['@fakeware/core']).toBeString()

    const config = readFileSync(join(dir, 'fakeware.config.ts'), 'utf8')
    expect(config).toContain("from '@fakeware/core/config'")
    expect(config).toContain('$SHOPWARE_URL')
    expect(config).toContain('locale: "de-DE"')

    const env = readFileSync(join(dir, '.env'), 'utf8')
    expect(env).toContain('SHOPWARE_URL=https://my-shop.test')
    expect(env).toContain('SHOPWARE_CLIENT_SECRET=secret')

    const gitignore = readFileSync(join(dir, '.gitignore'), 'utf8')
    expect(gitignore.split('\n')).toContain('.env')
  })

  test('inline secrets embed literal credentials and skip .env', async () => {
    const dir = tmp()
    const created = await scaffoldProject({
      dir,
      format: 'ts',
      force: false,
      values: { ...values, secrets: 'inline' },
    })
    expect(created.map((f) => f.path.split('/').pop())).not.toContain('.env')
    const config = readFileSync(join(dir, 'fakeware.config.ts'), 'utf8')
    expect(config).toContain('https://my-shop.test')
    expect(config).not.toContain('$SHOPWARE_URL')
  })

  test('refuses to overwrite without force', async () => {
    const dir = tmp()
    writeFileSync(join(dir, 'package.json'), '{}')
    await expect(
      scaffoldProject({ dir, format: 'ts', force: false, values }),
    ).rejects.toBeInstanceOf(ScaffoldError)
  })

  test('overwrites with force', async () => {
    const dir = tmp()
    writeFileSync(join(dir, 'package.json'), '{"old":true}')
    await scaffoldProject({ dir, format: 'ts', force: true, values })
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
    expect(pkg.old).toBeUndefined()
    expect(pkg.name).toBe('my-shop-seed')
  })

  test('does not duplicate .env in an existing .gitignore', async () => {
    const dir = tmp()
    writeFileSync(join(dir, '.gitignore'), 'node_modules/\n.env\n')
    await scaffoldProject({ dir, format: 'ts', force: false, values })
    const gitignore = readFileSync(join(dir, '.gitignore'), 'utf8')
    const occurrences = gitignore.split('\n').filter((l: string) => l.trim() === '.env').length
    expect(occurrences).toBe(1)
  })

  test('json format emits a parseable config without imports', async () => {
    const dir = tmp()
    await scaffoldProject({ dir, format: 'json', force: false, values })
    const config = JSON.parse(readFileSync(join(dir, 'fakeware.config.json'), 'utf8'))
    expect(config.shopware.url).toBe('$SHOPWARE_URL')
    expect(config.locale).toBe('de-DE')
  })
})

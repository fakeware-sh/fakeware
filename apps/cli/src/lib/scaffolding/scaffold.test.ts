import { describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseModule } from 'magicast'
import { ScaffoldError, scaffoldProject } from './scaffold'
import type { ScaffoldValues } from './values'

function tmp(): string {
  return mkdtempSync(join(tmpdir(), 'fw-scaffold-'))
}

function configObject(source: string): Record<string, unknown> {
  return parseModule(source).exports.default.$args[0] as Record<string, unknown>
}

const values: ScaffoldValues = {
  projectName: 'my-shop-seed',
  url: 'https://my-shop.test',
  clientId: 'id',
  clientSecret: 'secret',
  secrets: 'env',
}

describe('scaffoldProject', () => {
  test('writes package.json, config, .env and .gitignore with env secrets', async () => {
    const dir = tmp()
    const created = await scaffoldProject({ dir, force: false, values })

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
    expect(config).toContain('defineConfig(')
    const cfg = configObject(config)
    expect((cfg.shopware as Record<string, unknown>).url).toBe('$SHOPWARE_URL')

    const env = readFileSync(join(dir, '.env'), 'utf8')
    expect(env).toContain('SHOPWARE_URL=https://my-shop.test')
    expect(env).toContain('SHOPWARE_CLIENT_SECRET=secret')

    const gitignore = readFileSync(join(dir, '.gitignore'), 'utf8')
    expect(gitignore.split('\n')).toContain('.env')
  })

  test('writes .gitignore before .env so the secret is never unignored on disk', async () => {
    const dir = tmp()
    const created = await scaffoldProject({ dir, force: false, values })
    const order = created.map((f) => f.path.split('/').pop())
    expect(order.indexOf('.gitignore')).toBeLessThan(order.indexOf('.env'))
  })

  test('inline secrets embed literal credentials and skip .env', async () => {
    const dir = tmp()
    const created = await scaffoldProject({
      dir,
      force: false,
      values: { ...values, secrets: 'inline' },
    })
    expect(created.map((f) => f.path.split('/').pop())).not.toContain('.env')
    const cfg = configObject(readFileSync(join(dir, 'fakeware.config.ts'), 'utf8'))
    expect((cfg.shopware as Record<string, unknown>).url).toBe('https://my-shop.test')
  })

  test('omits shopware block and .env when no connection is provided', async () => {
    const dir = tmp()
    const created = await scaffoldProject({
      dir,
      force: false,
      values: { projectName: 'my-plugin', secrets: 'env' },
    })
    const names = created.map((f) => f.path.split('/').pop())
    expect(names).toContain('package.json')
    expect(names).toContain('fakeware.config.ts')
    expect(names).not.toContain('.env')
    expect(names).not.toContain('.gitignore')

    const config = readFileSync(join(dir, 'fakeware.config.ts'), 'utf8')
    expect(config).toContain("from '@fakeware/core/config'")
    const cfg = configObject(config)
    expect(cfg.shopware).toBeUndefined()
  })

  test('refuses to overwrite without force', async () => {
    const dir = tmp()
    writeFileSync(join(dir, 'package.json'), '{}')
    await expect(scaffoldProject({ dir, force: false, values })).rejects.toBeInstanceOf(
      ScaffoldError,
    )
  })

  test('overwrites with force', async () => {
    const dir = tmp()
    writeFileSync(join(dir, 'package.json'), '{"old":true}')
    await scaffoldProject({ dir, force: true, values })
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
    expect(pkg.old).toBeUndefined()
    expect(pkg.name).toBe('my-shop-seed')
  })

  test('does not duplicate .env in an existing .gitignore', async () => {
    const dir = tmp()
    writeFileSync(join(dir, '.gitignore'), 'node_modules/\n.env\n')
    await scaffoldProject({ dir, force: false, values })
    const gitignore = readFileSync(join(dir, '.gitignore'), 'utf8')
    const occurrences = gitignore.split('\n').filter((l: string) => l.trim() === '.env').length
    expect(occurrences).toBe(1)
  })

  test('dry run reports files without writing them', async () => {
    const dir = tmp()
    const created = await scaffoldProject({ dir, force: false, values, dryRun: true })
    expect(created.map((f) => f.path.split('/').pop())).toContain('fakeware.config.ts')
    expect(() => readFileSync(join(dir, 'fakeware.config.ts'), 'utf8')).toThrow()
    expect(() => readFileSync(join(dir, 'package.json'), 'utf8')).toThrow()
  })
})

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LoadModuleError, loadModule } from './load-module'

describe('loadModule', () => {
  let dir: string

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'fakeware-load-'))
  })

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  test('imports a TypeScript module by absolute path', async () => {
    const file = join(dir, 'mod.ts')
    await writeFile(file, 'export const answer: number = 42\nexport default { ok: true }\n')

    const mod = await loadModule<{ answer: number; default: { ok: boolean } }>(file)

    expect(mod.answer).toBe(42)
    expect(mod.default.ok).toBe(true)
  })

  test('resolves an extensionless relative import', async () => {
    await writeFile(join(dir, 'shared.ts'), 'export const SHARED = 7\n')
    const file = join(dir, 'uses-shared.ts')
    await writeFile(file, "import { SHARED } from './shared'\nexport default SHARED * 2\n")

    const mod = await loadModule<{ default: number }>(file)
    expect(mod.default).toBe(14)
  })

  test('throws LoadModuleError for a missing file', async () => {
    await expect(loadModule(join(dir, 'does-not-exist.ts'))).rejects.toBeInstanceOf(LoadModuleError)
  })
})

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRegistry, drain, runWithRegistry } from '../define'
import { createModuleLoader, LoadModuleError } from './load-module'

describe('createModuleLoader', () => {
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

    const mod = await createModuleLoader().import<{ answer: number; default: { ok: boolean } }>(
      file,
    )

    expect(mod.answer).toBe(42)
    expect(mod.default.ok).toBe(true)
  })

  test('resolves an extensionless relative import', async () => {
    await writeFile(join(dir, 'shared.ts'), 'export const SHARED = 7\n')
    const file = join(dir, 'uses-shared.ts')
    await writeFile(file, "import { SHARED } from './shared'\nexport default SHARED * 2\n")

    const mod = await createModuleLoader().import<{ default: number }>(file)
    expect(mod.default).toBe(14)
  })

  test('throws LoadModuleError for a missing file', async () => {
    await expect(
      createModuleLoader().import(join(dir, 'does-not-exist.ts')),
    ).rejects.toBeInstanceOf(LoadModuleError)
  })

  test("define() from '@fakeware/core' lands in the active registry", async () => {
    const file = join(dir, 'seed.ts')
    await writeFile(
      file,
      "import { define } from '@fakeware/core'\ndefine('tax', [{ $key: 'standard', taxRate: 19 }])\n",
    )

    const registry = createRegistry()
    const drained = await runWithRegistry(registry, async () => {
      await createModuleLoader().import(file)
      return drain(registry)
    })

    expect(drained).toHaveLength(1)
    expect(drained[0]?.entity).toBe('tax')
    expect(drained[0]?.entries).toHaveLength(1)
  })

  test('each run drains only what its own files defined', async () => {
    const first = join(dir, 'seed-first.ts')
    const second = join(dir, 'seed-second.ts')
    await writeFile(
      first,
      "import { define } from '@fakeware/core'\ndefine('tax', [{ $key: 'reduced', taxRate: 7 }])\n",
    )
    await writeFile(
      second,
      "import { define } from '@fakeware/core'\ndefine('currency', [{ $key: 'eur' }])\n",
    )

    const load = async (file: string) => {
      const registry = createRegistry()
      return runWithRegistry(registry, async () => {
        await createModuleLoader().import(file)
        return drain(registry)
      })
    }

    expect((await load(first)).map((d) => d.entity)).toEqual(['tax'])
    expect((await load(second)).map((d) => d.entity)).toEqual(['currency'])
  })
})

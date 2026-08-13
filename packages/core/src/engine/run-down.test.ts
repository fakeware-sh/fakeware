import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { LoadedConfig } from '../config'
import { ShopwareApiError } from '../shopware'
import { fakeShopContext } from '../testing/fake-shop-context'
import { createInMemorySink } from '../testing/in-memory-sink'
import { buildManifest, readManifest, writeManifest } from './manifest'
import { runDown } from './run-down'
import { runUp } from './run-up'
import type { ApplyFailure, RunOptions } from './types'

const coreIndex = join(import.meta.dir, '..', 'index.ts')
const shopContext = fakeShopContext()

function up(opts: Omit<RunOptions, 'shopContext'>): ReturnType<typeof runUp> {
  return runUp({ shopContext, ...opts })
}

let counter = 0

function loadedFor(dir: string): LoadedConfig {
  return {
    config: { shopware: { url: 'https://shop.test', clientId: 'i', clientSecret: 's' } },
    connection: { url: 'https://shop.test', clientId: 'i', clientSecret: 's' },
    configPath: join(dir, 'fakeware.config.ts'),
    projectRoot: dir,
    plugins: [],
  }
}

async function scaffoldProject(root: string, files: Record<string, string>): Promise<string> {
  const dir = join(root, `p${counter++}`)
  await mkdir(join(dir, 'data'), { recursive: true })
  for (const [name, body] of Object.entries(files)) {
    await writeFile(join(dir, 'data', name), body)
  }
  return dir
}

const TAX_19 = `import { define } from '${coreIndex}'
define('tax', [{ $key: 'standard', taxRate: 19 }])
`
const PRODUCTS = `import { define, many, ref } from '${coreIndex}'
define('product', many(2, (ctx) => ({ name: 'p' + ctx.index, taxId: ref('tax').key('standard') })))
`

describe('runDown', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'fakeware-run-'))
  })
  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  test('down deletes exactly the manifest records (reverse order) and removes the manifest', async () => {
    const dir = await scaffoldProject(root, { 'tax.ts': TAX_19, 'product.ts': PRODUCTS })
    const loaded = loadedFor(dir)
    await up({ loaded, sink: createInMemorySink(), now: 'T', fakewareVersion: '1' })

    const sink = createInMemorySink()
    const result = await runDown({ loaded, sink })

    const deletes = sink.calls.filter((c) => c.op === 'delete').map((c) => c.entity)
    expect(deletes.indexOf('product')).toBeLessThan(deletes.indexOf('tax'))
    expect(result.reverted).toBe(true)

    const after = await runDown({ loaded, sink: createInMemorySink() })
    expect(after.reverted).toBe(false)
  })

  test('down with no manifest is a friendly no-op', async () => {
    const dir = await scaffoldProject(root, {})
    const sink = createInMemorySink()
    const result = await runDown({ loaded: loadedFor(dir), sink })
    expect(result.reverted).toBe(false)
    expect(result.failures).toEqual([])
    expect(sink.calls).toHaveLength(0)
  })
})

describe('runDown resilience', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'fakeware-down-'))
  })
  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  async function seedManifest(dir: string, entities: string[]): Promise<void> {
    await writeManifest(
      dir,
      buildManifest({
        fakewareVersion: '1',
        createdAt: 'T',
        shopwareUrl: 'https://shop.test',
        entities: entities.map((entity) => ({
          entity,
          records: [{ id: `${entity}-1`, hash: 'h' }],
        })),
      }),
    )
  }

  test('converges across passes: a conflict clears once its dependent is deleted', async () => {
    const dir = await scaffoldProject(root, {})
    // manifest order [tax, product] → reverse tries product first, then tax.
    // tax is "in use" until product is gone; one extra pass should clear it.
    await seedManifest(dir, ['tax', 'product'])
    const sink = createInMemorySink({
      failDeleteWhile: (entity, deleted) => entity === 'tax' && !deleted.has('product'),
    })

    const result = await runDown({ loaded: loadedFor(dir), sink })

    expect(result.reverted).toBe(true)
    expect(result.failures).toEqual([])
    const deletes = sink.calls.filter((c) => c.op === 'delete').map((c) => c.entity)
    expect(deletes).toEqual(['product', 'tax'])
    expect(await readManifest(dir, 'https://shop.test')).toBeNull()
  })

  test('keeps only the still-blocked entities in the manifest and reports failures', async () => {
    const dir = await scaffoldProject(root, {})
    await seedManifest(dir, ['tax', 'product'])
    const failures: ApplyFailure[] = []
    const sink = createInMemorySink({ failDeleteOn: 'tax' })

    const result = await runDown({
      loaded: loadedFor(dir),
      sink,
      reporter: { failed: (f) => failures.push(f) },
    })

    expect(result.reverted).toBe(false)
    expect(result.failures.map((f) => f.entity)).toEqual(['tax'])
    expect(result.failures[0]?.error).toBeInstanceOf(ShopwareApiError)
    expect(failures.map((f) => f.entity)).toEqual(['tax'])

    const manifest = await readManifest(dir, 'https://shop.test')
    expect(manifest?.entities.map((e) => e.entity)).toEqual(['tax'])
  })

  test('re-running down after the conflict clears finishes the teardown (converges)', async () => {
    const dir = await scaffoldProject(root, {})
    await seedManifest(dir, ['tax', 'product'])

    await runDown({ loaded: loadedFor(dir), sink: createInMemorySink({ failDeleteOn: 'tax' }) })
    // manifest now lists only tax; conflict cleared on the retry.
    const sink = createInMemorySink()
    const result = await runDown({ loaded: loadedFor(dir), sink })

    expect(result.reverted).toBe(true)
    expect(sink.calls.filter((c) => c.op === 'delete').map((c) => c.entity)).toEqual(['tax'])
    expect(await readManifest(dir, 'https://shop.test')).toBeNull()
  })

  test('an unexpected (non-Shopware) delete error aborts rather than being swallowed', async () => {
    const dir = await scaffoldProject(root, {})
    await seedManifest(dir, ['tax'])
    const sink = createInMemorySink()
    sink.delete = async () => {
      throw new TypeError('boom')
    }
    await expect(runDown({ loaded: loadedFor(dir), sink })).rejects.toBeInstanceOf(TypeError)
  })

  test('dry-run reports steps, deletes nothing, leaves the manifest', async () => {
    const dir = await scaffoldProject(root, {})
    await seedManifest(dir, ['tax', 'product'])
    const sink = createInMemorySink()
    const result = await runDown({ loaded: loadedFor(dir), sink, dryRun: true })

    expect(result.reverted).toBe(false)
    expect(sink.calls).toHaveLength(0)
    expect(await readManifest(dir, 'https://shop.test')).not.toBeNull()
  })
})

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { LoadedConfig } from '../config'
import { createInMemorySink } from '../domain'
import { buildManifest, writeManifest } from './manifest'
import { runDown, runUp } from './run'

const coreIndex = join(import.meta.dir, '..', 'index.ts')

let counter = 0

function loadedFor(dir: string): LoadedConfig {
  return {
    config: { shopware: { url: 'https://shop.test', clientId: 'i', clientSecret: 's' } },
    connection: { url: 'https://shop.test', clientId: 'i', clientSecret: 's' },
    configPath: join(dir, 'fakeware.config.ts'),
    projectRoot: dir,
  }
}

async function runFixture(fixture: string, projectRoot: string): Promise<string> {
  const proc = Bun.spawn(['bun', 'run', fixture, projectRoot], { stdout: 'pipe' })
  const out = await new Response(proc.stdout).text()
  await proc.exited
  return out
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
define('product', many(2, (ctx) => ({ name: 'p' + ctx.index, taxId: ref('tax/standard') })))
`

describe('runUp / runDown', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'fakeware-run-'))
  })
  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  test('upserts every entity in dependency order and writes a manifest', async () => {
    const dir = await scaffoldProject(root, { 'tax.ts': TAX_19, 'product.ts': PRODUCTS })
    const sink = createInMemorySink()
    const result = await runUp({ loaded: loadedFor(dir), sink, now: 'T', fakewareVersion: '1' })

    const upserts = sink.calls.filter((c) => c.op === 'upsert').map((c) => c.entity)
    expect(upserts.indexOf('tax')).toBeLessThan(upserts.indexOf('product'))
    expect(sink.snapshot().get('product')?.size).toBe(2)
    expect(result.steps.find((s) => s.entity === 'tax')?.created).toBe(1)
    expect(result.manifestWritten).toBe(true)
  })

  test('a second up in a fresh process touches nothing (idempotent)', async () => {
    const dir = await scaffoldProject(root, { 'tax.ts': TAX_19, 'product.ts': PRODUCTS })
    const fixture = join(import.meta.dir, 'run-once.fixture.ts')

    const first = await runFixture(fixture, dir)
    expect(JSON.parse(first).length).toBeGreaterThan(0)

    const second = await runFixture(fixture, dir)
    expect(JSON.parse(second)).toEqual([])
  })

  test('re-upserts only the records whose hash drifted from the manifest', async () => {
    const dir = await scaffoldProject(root, { 'tax.ts': TAX_19 })
    await writeManifest(
      dir,
      buildManifest({
        fakewareVersion: '1',
        createdAt: 'T',
        shopwareUrl: 'https://shop.test',
        entities: [{ entity: 'tax', records: [{ id: 'unused', hash: 'STALE' }] }],
      }),
    )

    const sink = createInMemorySink()
    const result = await runUp({ loaded: loadedFor(dir), sink, now: 'T', fakewareVersion: '1' })

    const upserts = sink.calls.filter((c) => c.op === 'upsert')
    expect(upserts).toHaveLength(1)
    expect(upserts[0]?.entity).toBe('tax')
    expect(result.steps[0]?.created).toBe(1)
  })

  test('dry-run writes nothing and leaves no manifest', async () => {
    const dir = await scaffoldProject(root, { 'tax.ts': TAX_19 })
    const sink = createInMemorySink()
    const result = await runUp({ loaded: loadedFor(dir), sink, dryRun: true })
    expect(sink.calls).toHaveLength(0)
    expect(result.manifestWritten).toBe(false)
  })

  test('down deletes exactly the manifest records (reverse order) and removes the manifest', async () => {
    const dir = await scaffoldProject(root, { 'tax.ts': TAX_19, 'product.ts': PRODUCTS })
    const loaded = loadedFor(dir)
    await runUp({ loaded, sink: createInMemorySink(), now: 'T', fakewareVersion: '1' })

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
    expect(sink.calls).toHaveLength(0)
  })
})

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { LoadedConfig } from '../config'
import { createInMemorySink } from '../domain'
import { TransactionError } from './errors'
import { buildManifest, readManifest, writeManifest } from './manifest'
import { type OnError, runDown, runUp } from './run'

const coreIndex = join(import.meta.dir, '..', 'index.ts')

let counter = 0

function loadedFor(
  dir: string,
  transaction: { onError: OnError; atomic: boolean } = { onError: 'rollback', atomic: false },
): LoadedConfig {
  return {
    config: {
      shopware: { url: 'https://shop.test', clientId: 'i', clientSecret: 's' },
      transaction,
    },
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

describe('runUp transactions', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'fakeware-tx-'))
  })
  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  const atomic = { onError: 'rollback' as OnError, atomic: true }

  test('atomic path issues a single applyAtomic with every entity in dependency order', async () => {
    const dir = await scaffoldProject(root, { 'tax.ts': TAX_19, 'product.ts': PRODUCTS })
    const sink = createInMemorySink()
    const result = await runUp({
      loaded: loadedFor(dir, atomic),
      sink,
      now: 'T',
      fakewareVersion: '1',
    })

    const atomicCalls = sink.calls.filter((c) => c.op === 'applyAtomic')
    expect(atomicCalls).toHaveLength(1)
    expect(sink.calls.filter((c) => c.op === 'upsert')).toHaveLength(0)
    const order = atomicCalls[0]?.operations.map((o) => o.entity) ?? []
    expect(order.indexOf('tax')).toBeLessThan(order.indexOf('product'))
    expect(result.mode).toBe('atomic')
    expect(result.manifestWritten).toBe(true)
    expect(await readManifest(dir, 'https://shop.test')).not.toBeNull()
  })

  test('atomic rollback: a failed applyAtomic writes no manifest and leaves the store empty', async () => {
    const dir = await scaffoldProject(root, { 'tax.ts': TAX_19, 'product.ts': PRODUCTS })
    const sink = createInMemorySink({ failApplyAtomic: true })

    await expect(
      runUp({ loaded: loadedFor(dir, atomic), sink, now: 'T', fakewareVersion: '1' }),
    ).rejects.toThrow()

    expect(sink.snapshot().size).toBe(0)
    expect(await readManifest(dir, 'https://shop.test')).toBeNull()
  })

  test('saga rollback: deletes created records in reverse order and throws TransactionError', async () => {
    const dir = await scaffoldProject(root, { 'tax.ts': TAX_19, 'product.ts': PRODUCTS })
    const sink = createInMemorySink({ failUpsertOn: 'product' })

    let caught: unknown
    try {
      await runUp({
        loaded: loadedFor(dir, { onError: 'rollback', atomic: false }),
        sink,
        now: 'T',
        fakewareVersion: '1',
      })
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(TransactionError)
    expect((caught as TransactionError).failedEntity).toBe('product')
    const deletes = sink.calls.filter((c) => c.op === 'delete')
    expect(deletes.map((c) => c.entity)).toEqual(['tax'])
    expect(sink.snapshot().get('tax')?.size ?? 0).toBe(0)
    expect(await readManifest(dir, 'https://shop.test')).toBeNull()
  })

  test('saga rollback surfaces a TransactionError even when compensation itself fails', async () => {
    const dir = await scaffoldProject(root, { 'tax.ts': TAX_19, 'product.ts': PRODUCTS })
    const sink = createInMemorySink({ failUpsertOn: 'product', failDeleteOn: 'tax' })

    let caught: unknown
    try {
      await runUp({
        loaded: loadedFor(dir, { onError: 'rollback', atomic: false }),
        sink,
        now: 'T',
        fakewareVersion: '1',
      })
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(TransactionError)
    const tx = caught as TransactionError
    expect(tx.failedEntity).toBe('product')
    expect(tx.compensationErrors).toHaveLength(1)
    expect(tx.rolledBack).toHaveLength(0)
    expect(await readManifest(dir, 'https://shop.test')).toBeNull()
  })

  test('saga rollback only deletes records this run created, not pre-existing updates', async () => {
    const dir = await scaffoldProject(root, { 'tax.ts': TAX_19, 'product.ts': PRODUCTS })
    const firstSink = createInMemorySink()
    await runUp({
      loaded: loadedFor(dir, { onError: 'rollback', atomic: false }),
      sink: firstSink,
      now: 'T',
      fakewareVersion: '1',
    })
    const taxId = [...(firstSink.snapshot().get('tax')?.keys() ?? [])][0]

    await writeFile(
      join(dir, 'data', 'tax.ts'),
      `import { define } from '${coreIndex}'\ndefine('tax', [{ $key: 'standard', taxRate: 20 }])\n`,
    )

    const sink = createInMemorySink({ failUpsertOn: 'product' })
    await runUp({
      loaded: loadedFor(dir, { onError: 'rollback', atomic: false }),
      sink,
      now: 'T',
      fakewareVersion: '1',
    }).catch(() => {})

    const deletedTaxIds = sink.calls.filter((c) => c.op === 'delete' && c.entity === 'tax')
    expect(deletedTaxIds).toHaveLength(0)
    expect(taxId).toBeDefined()
  })

  test("onError 'stop' leaves successfully-written entities in place and writes no manifest", async () => {
    const dir = await scaffoldProject(root, { 'tax.ts': TAX_19, 'product.ts': PRODUCTS })
    const sink = createInMemorySink({ failUpsertOn: 'product' })

    await expect(
      runUp({
        loaded: loadedFor(dir, { onError: 'stop', atomic: false }),
        sink,
        now: 'T',
        fakewareVersion: '1',
      }),
    ).rejects.toThrow()

    expect(sink.calls.filter((c) => c.op === 'delete')).toHaveLength(0)
    expect(sink.snapshot().get('tax')?.size).toBe(1)
    expect(await readManifest(dir, 'https://shop.test')).toBeNull()
  })

  test("onError 'continue' skips the failing entity, applies the rest, throws, writes a restricted manifest", async () => {
    const dir = await scaffoldProject(root, { 'tax.ts': TAX_19, 'product.ts': PRODUCTS })
    const sink = createInMemorySink({ failUpsertOn: 'product' })

    let caught: unknown
    try {
      await runUp({
        loaded: loadedFor(dir, { onError: 'continue', atomic: false }),
        sink,
        now: 'T',
        fakewareVersion: '1',
      })
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(TransactionError)
    expect(sink.snapshot().get('tax')?.size).toBe(1)
    expect(sink.calls.filter((c) => c.op === 'delete')).toHaveLength(0)
    const manifest = await readManifest(dir, 'https://shop.test')
    expect(manifest?.entities.map((e) => e.entity)).toEqual(['tax'])
  })

  test('the byte threshold falls back from atomic to the saga path', async () => {
    const dir = await scaffoldProject(root, { 'tax.ts': TAX_19, 'product.ts': PRODUCTS })
    const big = `import { define, many } from '${coreIndex}'
define('product', many(10, (ctx) => ({ name: 'p' + ctx.index, blob: 'x'.repeat(1024 * 1024) })))
`
    await writeFile(join(dir, 'data', 'product.ts'), big)

    const sink = createInMemorySink()
    const result = await runUp({
      loaded: loadedFor(dir, atomic),
      sink,
      now: 'T',
      fakewareVersion: '1',
    })

    expect(result.mode).toBe('saga')
    expect(sink.calls.filter((c) => c.op === 'applyAtomic')).toHaveLength(0)
    expect(sink.calls.filter((c) => c.op === 'upsert').length).toBeGreaterThan(0)
  })

  test('atomic:false forces the saga path even for a small dataset', async () => {
    const dir = await scaffoldProject(root, { 'tax.ts': TAX_19 })
    const sink = createInMemorySink()
    const result = await runUp({
      loaded: loadedFor(dir, { onError: 'rollback', atomic: false }),
      sink,
      now: 'T',
      fakewareVersion: '1',
    })

    expect(result.mode).toBe('saga')
    expect(sink.calls.filter((c) => c.op === 'applyAtomic')).toHaveLength(0)
  })

  test('a no-op run touches neither path and writes no manifest', async () => {
    const dir = await scaffoldProject(root, { 'tax.ts': TAX_19 })
    await runUp({ loaded: loadedFor(dir, atomic), sink: createInMemorySink(), now: 'T' })

    const sink = createInMemorySink()
    const result = await runUp({ loaded: loadedFor(dir, atomic), sink, now: 'T' })
    expect(result.mode).toBe('noop')
    expect(sink.calls).toHaveLength(0)
  })
})

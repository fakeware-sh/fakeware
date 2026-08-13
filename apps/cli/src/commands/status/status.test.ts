import { describe, expect, test } from 'bun:test'
import type { Manifest } from '@fakeware/core'
import { renderEntities, renderSummary } from './render'
import { buildReport, pendingEntities, toStatusEntities, totalRecords } from './report'

const base = {
  shopwareUrl: 'https://my-shop.test',
  configPath: '/project/fakeware.config.ts',
  plugins: [] as string[],
}

function manifest(
  entities: { entity: string; records: number; pending?: boolean }[] = [
    { entity: 'product', records: 3 },
    { entity: 'tax', records: 1 },
  ],
): Manifest {
  return {
    version: 2,
    fakewareVersion: '0.1.0',
    createdAt: '2026-08-13T10:00:00.000Z',
    shopwareUrl: base.shopwareUrl,
    checksum: 'not-read-by-the-status-report',
    entities: entities.map((e) => ({
      entity: e.entity,
      records: Array.from({ length: e.records }, (_, i) => ({
        id: `${e.entity}-${i}`,
        hash: `hash-${i}`,
      })),
      ...(e.pending === undefined ? {} : { pending: e.pending }),
    })),
  }
}

describe('buildReport', () => {
  test('reports a null manifest when nothing has been applied', () => {
    const report = buildReport(base, null)
    expect(report.manifest).toBeNull()
    expect(report.shopwareUrl).toBe('https://my-shop.test')
  })

  test('summarises entities, record counts and the manifest metadata', () => {
    const report = buildReport(base, manifest())
    expect(report.manifest?.records).toBe(4)
    expect(report.manifest?.fakewareVersion).toBe('0.1.0')
    expect(report.manifest?.createdAt).toBe('2026-08-13T10:00:00.000Z')
    expect(report.manifest?.version).toBe(2)
    expect(report.manifest?.entities.map((e) => e.entity)).toEqual(['product', 'tax'])
  })

  test('sorts entities by name so the output is stable across runs', () => {
    const report = buildReport(
      base,
      manifest([
        { entity: 'tax', records: 1 },
        { entity: 'category', records: 2 },
        { entity: 'product', records: 1 },
      ]),
    )
    expect(report.manifest?.entities.map((e) => e.entity)).toEqual(['category', 'product', 'tax'])
  })

  test('carries plugin names through', () => {
    const report = buildReport({ ...base, plugins: ['pickware'] }, null)
    expect(report.plugins).toEqual(['pickware'])
  })
})

describe('pending entities', () => {
  test('are empty for a clean manifest', () => {
    expect(pendingEntities(buildReport(base, manifest()))).toEqual([])
  })

  test('are listed when a run was interrupted', () => {
    const report = buildReport(
      base,
      manifest([
        { entity: 'product', records: 3, pending: true },
        { entity: 'tax', records: 1 },
      ]),
    )
    expect(pendingEntities(report)).toEqual(['product'])
    expect(report.manifest?.entities.find((e) => e.entity === 'product')?.pending).toBe(true)
  })

  test('are empty when there is no manifest at all', () => {
    expect(pendingEntities(buildReport(base, null))).toEqual([])
  })
})

describe('toStatusEntities / totalRecords', () => {
  test('counts records per entity rather than listing ids', () => {
    const entities = toStatusEntities(manifest())
    expect(entities).toEqual([
      { entity: 'product', records: 3, pending: false },
      { entity: 'tax', records: 1, pending: false },
    ])
    expect(totalRecords(entities)).toBe(4)
  })

  test('totals zero for an empty manifest', () => {
    expect(totalRecords(toStatusEntities(manifest([])))).toBe(0)
  })
})

describe('rendering', () => {
  test('the summary shows the shop and config, and omits plugins when there are none', () => {
    const summary = renderSummary(buildReport(base, manifest()))
    expect(summary).toContain('https://my-shop.test')
    expect(summary).toContain('/project/fakeware.config.ts')
    expect(summary).toContain('fakeware 0.1.0')
    expect(summary).not.toContain('Plugins')
  })

  test('the summary lists plugins when the config has them', () => {
    const summary = renderSummary(buildReport({ ...base, plugins: ['pickware'] }, manifest()))
    expect(summary).toContain('Plugins')
    expect(summary).toContain('pickware')
  })

  test('the summary omits manifest rows when nothing has been applied', () => {
    const summary = renderSummary(buildReport(base, null))
    expect(summary).toContain('https://my-shop.test')
    expect(summary).not.toContain('Applied')
  })

  test('the entity table pluralises and flags pending entities', () => {
    const report = buildReport(
      base,
      manifest([
        { entity: 'product', records: 3, pending: true },
        { entity: 'tax', records: 1 },
      ]),
    )
    const table = renderEntities(report.manifest?.entities ?? [])
    expect(table).toContain('3 records')
    expect(table).toContain('1 record')
    expect(table).toContain('pending')
    expect(table.split('\n')).toHaveLength(2)
  })
})

describe('json output', () => {
  test('serialises to a stable, machine-readable shape', () => {
    const report = buildReport(base, manifest())
    const parsed = JSON.parse(JSON.stringify(report))
    expect(parsed).toEqual({
      shopwareUrl: 'https://my-shop.test',
      configPath: '/project/fakeware.config.ts',
      plugins: [],
      manifest: {
        createdAt: '2026-08-13T10:00:00.000Z',
        fakewareVersion: '0.1.0',
        version: 2,
        records: 4,
        entities: [
          { entity: 'product', records: 3, pending: false },
          { entity: 'tax', records: 1, pending: false },
        ],
      },
    })
  })

  test('a missing manifest is null rather than absent', () => {
    const parsed = JSON.parse(JSON.stringify(buildReport(base, null)))
    expect(parsed.manifest).toBeNull()
    expect('manifest' in parsed).toBe(true)
  })
})

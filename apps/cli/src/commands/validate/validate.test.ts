import { describe, expect, test } from 'bun:test'
import type { ValidateResult } from '@fakeware/core'
import { renderChecklist, renderCheckWarnings, renderIssues } from './render'

function result(overrides: Partial<ValidateResult> = {}): ValidateResult {
  return {
    ok: true,
    dataFiles: ['data/a.ts', 'data/b.ts'],
    entities: ['product', 'tax'],
    records: 4,
    issues: [],
    shopDependent: null,
    checks: [],
    checksSkipped: 0,
    skipReason: null,
    ...overrides,
  }
}

describe('renderChecklist', () => {
  test('marks every check as passed for a clean project', () => {
    const lines = renderChecklist(result()).split('\n')
    expect(lines).toHaveLength(4)
    for (const line of lines) expect(line).toContain('✔')
    expect(lines.join('\n')).toContain('2 files')
    expect(lines.join('\n')).toContain('2 entities, 4 records')
  })

  test('marks the failing check and skips the ones after it', () => {
    const checklist = renderChecklist(
      result({
        ok: false,
        issues: [{ check: 'references', message: "ref('tax').key('nope') not found" }],
      }),
    )
    const lines = checklist.split('\n')

    expect(lines[0]).toContain('✔')
    expect(lines[1]).toContain('✔')
    expect(lines[2]).toContain('✖')
    expect(lines[2]).toContain('References')
    expect(lines[3]).toContain('not checked')
  })

  test('a data file failure blocks every later check', () => {
    const checklist = renderChecklist(
      result({ ok: false, issues: [{ check: 'dataFiles', message: 'boom' }] }),
    )
    expect(checklist.split('\n')[0]).toContain('✖')
    expect(checklist).toContain('not checked')
    expect(checklist).not.toContain('✔')
  })

  test('an empty project reports nothing to check rather than passing checks', () => {
    const checklist = renderChecklist(result({ dataFiles: [], entities: [], records: 0 }))
    expect(checklist).toContain('no data files found')
    expect(checklist).toContain('nothing to check')
  })

  test('marks shop-dependent checks as needing the shop, not as failures', () => {
    const checklist = renderChecklist(result({ shopDependent: 'no warehouse found in the shop' }))
    const lines = checklist.split('\n')

    expect(lines[0]).toContain('✔')
    expect(lines[1]).toContain('✔')
    expect(lines[2]).toContain('needs the shop')
    expect(lines[3]).toContain('needs the shop')
    expect(checklist).not.toContain('✖')
  })

  test('pluralises a single file and a single record', () => {
    const checklist = renderChecklist(
      result({ dataFiles: ['data/a.ts'], entities: ['tax'], records: 1 }),
    )
    expect(checklist).toContain('1 file')
    expect(checklist).toContain('1 record')
    expect(checklist).not.toContain('1 files')
    expect(checklist).not.toContain('1 records')
  })

  test('omits the plugin row when no plugin declares a check', () => {
    expect(renderChecklist(result())).not.toContain('Plugin checks')
  })

  test('shows passing plugin checks above the core rows', () => {
    const lines = renderChecklist(
      result({
        checks: [{ plugin: 'pickware', check: 'erp installed', level: 'ok', message: 'passed' }],
      }),
    ).split('\n')

    expect(lines).toHaveLength(5)
    expect(lines[0]).toContain('Plugin checks')
    expect(lines[0]).toContain('1 check passed')
  })

  test('names the missing connection when checks were skipped for it', () => {
    const checklist = renderChecklist(result({ checksSkipped: 2, skipReason: 'noConnection' }))
    expect(checklist.split('\n')[0]).toContain('no shop configured')
    expect(checklist).not.toContain('✖')
  })

  test('names the flag when checks were skipped by request', () => {
    const checklist = renderChecklist(result({ checksSkipped: 2, skipReason: 'offline' }))
    expect(checklist.split('\n')[0]).toContain('skipped with --no-shop-checks')
  })

  test('marks the plugin row as failed without blocking the core checks', () => {
    const lines = renderChecklist(
      result({
        ok: false,
        issues: [{ check: 'plugins', message: 'pickware: not installed' }],
        checks: [
          { plugin: 'pickware', check: 'erp installed', level: 'error', message: 'not installed' },
        ],
      }),
    ).split('\n')

    expect(lines[0]).toContain('✖')
    expect(lines[0]).toContain('Plugin checks')
    expect(lines[1]).toContain('✔')
  })
})

describe('renderCheckWarnings', () => {
  test('shows the plugin, the message and the hint', () => {
    const rendered = renderCheckWarnings(
      result({
        checks: [
          {
            plugin: 'pickware',
            check: 'erp installed',
            level: 'warn',
            message: 'Pickware ERP 2.4.0 is older than the supported 3.0.0.',
            hint: 'Update Pickware ERP.',
          },
        ],
      }),
    )
    expect(rendered).toContain('pickware')
    expect(rendered).toContain('older than the supported 3.0.0')
    expect(rendered).toContain('Update Pickware ERP.')
  })

  test('returns nothing when no check warned', () => {
    expect(
      renderCheckWarnings(
        result({
          checks: [{ plugin: 'pickware', check: 'erp installed', level: 'ok', message: 'passed' }],
        }),
      ),
    ).toBe('')
  })
})

describe('renderIssues', () => {
  test('shows the failing check and its message', () => {
    const rendered = renderIssues(
      result({ ok: false, issues: [{ check: 'graph', message: 'cycle: a -> b -> a' }] }),
    )
    expect(rendered).toContain('Dependency graph')
    expect(rendered).toContain('cycle: a -> b -> a')
  })

  test('renders nothing when there are no issues', () => {
    expect(renderIssues(result())).toBe('')
  })
})

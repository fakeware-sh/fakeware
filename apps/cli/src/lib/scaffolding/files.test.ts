import { describe, expect, test } from 'bun:test'
import type { OfficialPlugin } from '../plugins'
import { FILE_SPECS } from './files'
import type { ScaffoldValues } from './values'

function packageJson(values: ScaffoldValues): Record<string, unknown> {
  const spec = FILE_SPECS.find((candidate) => candidate.name === 'package.json')
  if (!spec?.build) throw new Error('package.json spec not found')
  return JSON.parse(spec.build(values))
}

const base: ScaffoldValues = { projectName: 'demo', secrets: 'env', plugins: [] }

const pickware: OfficialPlugin = {
  id: 'pickware',
  packageName: '@fakeware/plugin-pickware',
  importName: 'pickware',
  version: '^1.1.0',
  label: 'Pickware',
  hint: 'ERP',
}

const other: OfficialPlugin = {
  id: 'other',
  packageName: '@fakeware/plugin-other',
  importName: 'other',
  version: '^2.0.0',
  label: 'Other',
  hint: 'Other',
}

describe('packageJsonTemplate devDependencies', () => {
  test('includes selected plugins alongside core and cli', () => {
    const deps = packageJson({ ...base, plugins: [pickware, other] }).devDependencies as Record<
      string,
      string
    >
    expect(deps['@fakeware/core']).toBeDefined()
    expect(deps['@fakeware/cli']).toBeDefined()
    expect(deps['@fakeware/plugin-pickware']).toBe('^1.1.0')
    expect(deps['@fakeware/plugin-other']).toBe('^2.0.0')
  })

  test('adds no plugin deps when none selected', () => {
    const deps = packageJson({ ...base, plugins: [] }).devDependencies as Record<string, string>
    expect(Object.keys(deps)).toEqual(['@fakeware/cli', '@fakeware/core'])
  })
})

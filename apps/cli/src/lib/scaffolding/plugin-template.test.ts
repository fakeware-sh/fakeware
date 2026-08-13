import { describe, expect, test } from 'bun:test'
import { pluginReadme, pluginSource, pluginTest } from './plugin-template'
import type { ScaffoldValues } from './values'

const values: ScaffoldValues = {
  projectName: 'fakeware-plugin-warehouse',
  secrets: 'inline',
  plugins: [],
  template: 'plugin',
}

describe('plugin templates', () => {
  test('the templates are bundled, not read from disk at runtime', () => {
    expect(pluginSource(values).length).toBeGreaterThan(0)
    expect(pluginTest(values).length).toBeGreaterThan(0)
    expect(pluginReadme().length).toBeGreaterThan(0)
  })

  test('the plugin name is rendered into the code templates', () => {
    for (const rendered of [pluginSource(values), pluginTest(values)]) {
      expect(rendered).toContain('fakeware-plugin-warehouse')
      expect(rendered).not.toContain('<%')
    }
  })

  test('the readme is static', () => {
    expect(pluginReadme()).toContain('fakeware.sh')
    expect(pluginReadme()).not.toContain('<%')
  })

  test('the source template imports only the public core surface', () => {
    const source = pluginSource(values)
    expect(source).toContain("from '@fakeware/core'")
    expect(source).toContain("from '@fakeware/core/shopware'")
    expect(source).not.toContain('@fakeware/core/src')
    expect(source).not.toContain('../../')
  })
})

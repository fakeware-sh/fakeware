import { describe, expect, test } from 'bun:test'
import { pluginReadme, pluginSource, pluginTest, projectData } from './render'
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

describe('templates only reference core APIs that exist', () => {
  const imported = (source: string, module: string): string[] => {
    const match = source.match(new RegExp(`import\\s*\\{([^}]+)\\}\\s*from '${module}'`))
    if (!match?.[1]) return []
    return match[1]
      .split(',')
      .map((name) => name.trim())
      .filter((name) => name.length > 0 && !name.startsWith('type '))
  }

  const missing = (source: string, module: string, actual: object): string[] =>
    imported(source, module).filter((name) => !(name in actual))

  test('the plugin source only imports symbols core actually exports', async () => {
    const source = pluginSource(values)
    expect(missing(source, '@fakeware/core', await import('@fakeware/core'))).toEqual([])
    expect(
      missing(source, '@fakeware/core/shopware', await import('@fakeware/core/shopware')),
    ).toEqual([])
  })

  test('the plugin test only imports symbols core/testing actually exports', async () => {
    const testing = await import('@fakeware/core/testing')
    expect(missing(pluginTest(values), '@fakeware/core/testing', testing)).toEqual([])
  })

  test('the data template only imports symbols core actually exports', async () => {
    const data = projectData()
    expect(missing(data, '@fakeware/core', await import('@fakeware/core'))).toEqual([])
    expect(
      missing(data, '@fakeware/core/shopware', await import('@fakeware/core/shopware')),
    ).toEqual([])
  })
})

describe('project data template', () => {
  test('is static and imports only the public core surface', () => {
    const data = projectData()
    expect(data.length).toBeGreaterThan(0)
    expect(data).not.toContain('<%')
    expect(data).toContain("from '@fakeware/core'")
    expect(data).toContain("from '@fakeware/core/shopware'")
    expect(data).not.toContain('@fakeware/core/src')
  })

  test('defines a tax rate before the product that references it', () => {
    const data = projectData()
    expect(data.indexOf("define('tax'")).toBeGreaterThan(-1)
    expect(data.indexOf("define('tax'")).toBeLessThan(data.indexOf("define(\n  'product'"))
    expect(data).toContain("ref('tax').key('standard')")
  })

  test('does not depend on packages the scaffold never installs', () => {
    expect(projectData()).not.toContain('@faker-js/faker')
    expect(projectData()).not.toContain('slugify')
  })
})

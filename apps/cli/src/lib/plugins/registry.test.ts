import { describe, expect, test } from 'bun:test'
import { findPlugins, OFFICIAL_PLUGINS, resolvePluginFlag } from './registry'

describe('OFFICIAL_PLUGINS', () => {
  test('ids and package names are unique', () => {
    const ids = OFFICIAL_PLUGINS.map((plugin) => plugin.id)
    const packages = OFFICIAL_PLUGINS.map((plugin) => plugin.packageName)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(packages).size).toBe(packages.length)
  })

  test('every version is a caret range', () => {
    for (const plugin of OFFICIAL_PLUGINS) {
      expect(plugin.version.startsWith('^')).toBe(true)
    }
  })
})

describe('findPlugins', () => {
  test('resolves by id', () => {
    expect(findPlugins(['pickware'])[0]?.packageName).toBe('@fakeware/plugin-pickware')
  })

  test('resolves by package name', () => {
    expect(findPlugins(['@fakeware/plugin-pickware'])[0]?.id).toBe('pickware')
  })

  test('throws with the valid ids on an unknown plugin', () => {
    expect(() => findPlugins(['nope'])).toThrow(/Unknown plugin: "nope"/)
    expect(() => findPlugins(['nope'])).toThrow(/pickware/)
  })
})

describe('resolvePluginFlag', () => {
  test('none resolves to an empty list', () => {
    expect(resolvePluginFlag('none')).toEqual([])
  })

  test('all resolves to the full registry', () => {
    expect(resolvePluginFlag('all')).toHaveLength(OFFICIAL_PLUGINS.length)
  })

  test('a comma list resolves each id', () => {
    expect(resolvePluginFlag('pickware')[0]?.id).toBe('pickware')
  })

  test('throws on an unknown token', () => {
    expect(() => resolvePluginFlag('pickware,nope')).toThrow(/Unknown plugin: "nope"/)
  })
})

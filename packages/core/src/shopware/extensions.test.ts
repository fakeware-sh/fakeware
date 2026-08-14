import { describe, expect, test } from 'bun:test'
import { createTestClient } from '../testing'
import { ShopwareConnectionError } from './errors'
import { fetchInstalledExtension, satisfiesMinVersion } from './extensions'

const INSTALLED = {
  name: 'PickwareErpStarter',
  version: '3.2.0',
  label: 'Pickware ERP',
  active: true,
  installedAt: '2026-01-01T00:00:00.000Z',
}

describe('fetchInstalledExtension', () => {
  test('returns an installed and active plugin', async () => {
    const { client } = createTestClient({ '/search/plugin': { data: [INSTALLED] } })
    expect(await fetchInstalledExtension(client, 'PickwareErpStarter')).toEqual({
      name: 'PickwareErpStarter',
      version: '3.2.0',
      label: 'Pickware ERP',
      active: true,
      kind: 'plugin',
    })
  })

  test('reports an installed plugin that is not active', async () => {
    const { client } = createTestClient({
      '/search/plugin': { data: [{ ...INSTALLED, active: false }] },
    })
    const extension = await fetchInstalledExtension(client, 'PickwareErpStarter')
    expect(extension?.active).toBe(false)
  })

  test('treats a row without installedAt as not installed', async () => {
    const { client } = createTestClient({
      '/search/plugin': { data: [{ ...INSTALLED, installedAt: null }] },
      '/search/app': { data: [] },
    })
    expect(await fetchInstalledExtension(client, 'PickwareErpStarter')).toBeNull()
  })

  test('returns null when neither a plugin nor an app matches', async () => {
    const { client } = createTestClient({
      '/search/plugin': { data: [] },
      '/search/app': { data: [] },
    })
    expect(await fetchInstalledExtension(client, 'PickwareErpStarter')).toBeNull()
  })

  test('ignores rows the server returned for another name', async () => {
    const { client } = createTestClient({
      '/search/plugin': { data: [{ ...INSTALLED, name: 'SomethingElse' }] },
      '/search/app': { data: [] },
    })
    expect(await fetchInstalledExtension(client, 'PickwareErpStarter')).toBeNull()
  })

  test('prefers the first candidate name that is installed', async () => {
    const { client } = createTestClient({
      '/search/plugin': {
        data: [
          { ...INSTALLED, name: 'PickwareErp', version: '2.0.0' },
          { ...INSTALLED, name: 'PickwareErpStarter', version: '3.2.0' },
        ],
      },
    })
    const extension = await fetchInstalledExtension(client, ['PickwareErpStarter', 'PickwareErp'])
    expect(extension?.name).toBe('PickwareErpStarter')
  })

  test('falls back to apps, where a row means installed', async () => {
    const { client } = createTestClient({
      '/search/plugin': { data: [] },
      '/search/app': { data: [{ name: 'SomeApp', version: '1.4.0', active: true }] },
    })
    expect(await fetchInstalledExtension(client, 'SomeApp')).toEqual({
      name: 'SomeApp',
      version: '1.4.0',
      label: null,
      active: true,
      kind: 'app',
    })
  })

  test('filters server side on every candidate name', async () => {
    const { client, calls } = createTestClient({ '/search/plugin': { data: [INSTALLED] } })
    await fetchInstalledExtension(client, ['PickwareErpStarter', 'PickwareErp'])
    expect(calls[0]?.operation).toContain('/search/plugin')
    expect((calls[0]?.options as { body: unknown }).body).toEqual({
      filter: [
        {
          type: 'equalsAny',
          field: 'name',
          value: ['PickwareErpStarter', 'PickwareErp'],
        },
      ],
      limit: 25,
    })
  })

  test('rejects a malformed response', async () => {
    const { client } = createTestClient({ '/search/plugin': { data: [{ version: '3.0.0' }] } })
    expect(fetchInstalledExtension(client, 'PickwareErpStarter')).rejects.toBeInstanceOf(
      ShopwareConnectionError,
    )
  })

  test('lets an API error through so the caller can classify it', async () => {
    const { client } = createTestClient({
      '/search/plugin': () => {
        throw Object.assign(new Error('forbidden'), { status: 403 })
      },
    })
    expect(fetchInstalledExtension(client, 'PickwareErpStarter')).rejects.toThrow('forbidden')
  })

  test('returns null without a request when no name is given', async () => {
    const { client, calls } = createTestClient({})
    expect(await fetchInstalledExtension(client, [])).toBeNull()
    expect(calls).toHaveLength(0)
  })
})

describe('satisfiesMinVersion', () => {
  test.each([
    ['3.0.0', '3.0.0', true],
    ['3.0.1', '3.0.0', true],
    ['3.10.0', '3.9.0', true],
    ['2.9.9', '3.0.0', false],
    ['3.1', '3.1.0', true],
    ['3.1', '3.1.1', false],
    ['4', '3.0.0', true],
    ['3.0.0-rc.1', '3.0.0', true],
    ['3.0.0+build.5', '3.0.0', true],
    ['nonsense', '3.0.0', false],
  ])('%s against %s is %p', (version, minimum, expected) => {
    expect(satisfiesMinVersion(version, minimum)).toBe(expected)
  })
})

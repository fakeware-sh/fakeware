import { describe, expect, test } from 'bun:test'
import { createTestCheckContext, createTestClient } from '@fakeware/core/testing'
import { pickwareInstalledCheck } from './checks'

const ROW = {
  name: 'PickwareErpStarter',
  version: '3.2.0',
  label: 'Pickware ERP',
  active: true,
  installedAt: '2026-01-01T00:00:00.000Z',
}

function runWith(handlers: Record<string, unknown>) {
  const { client, calls } = createTestClient(handlers)
  const ctx = createTestCheckContext({ name: 'pickware', client })
  return { outcome: pickwareInstalledCheck.run(ctx), calls }
}

describe('pickwareInstalledCheck', () => {
  test('needs the shop', () => {
    expect(pickwareInstalledCheck.needsShop).toBe(true)
  })

  test('passes for an installed, active, current version', async () => {
    const { outcome } = runWith({ '/search/plugin': { data: [ROW] } })
    expect(await outcome).toBeUndefined()
  })

  test('fails when pickware erp is not installed', async () => {
    const { outcome } = runWith({ '/search/plugin': { data: [] }, '/search/app': { data: [] } })
    const result = await outcome
    expect(result?.level).toBe('error')
    expect(result?.message).toContain('not installed')
    expect(result?.message).toContain('https://shop.test')
    expect(result?.hint).toContain('remove pickware()')
  })

  test('fails when pickware erp is installed but not activated', async () => {
    const { outcome } = runWith({ '/search/plugin': { data: [{ ...ROW, active: false }] } })
    const result = await outcome
    expect(result?.level).toBe('error')
    expect(result?.message).toContain('not activated')
  })

  test('warns when the installed version is older than supported', async () => {
    const { outcome } = runWith({ '/search/plugin': { data: [{ ...ROW, version: '2.4.0' }] } })
    const result = await outcome
    expect(result?.level).toBe('warn')
    expect(result?.message).toContain('2.4.0')
    expect(result?.message).toContain('3.0.0')
  })

  test('warns instead of failing when the credentials lack plugin:read', async () => {
    const { outcome } = runWith({
      '/search/plugin': () => {
        throw Object.assign(new Error('forbidden'), { status: 403 })
      },
    })
    const result = await outcome
    expect(result?.level).toBe('warn')
    expect(result?.message).toContain('plugin:read')
  })

  test('rethrows an error that is not a permission problem', async () => {
    const { outcome } = runWith({
      '/search/plugin': () => {
        throw Object.assign(new Error('gateway down'), { status: 502 })
      },
    })
    expect(outcome).rejects.toThrow('gateway down')
  })

  test('accepts the legacy PickwareErp name', async () => {
    const { outcome } = runWith({
      '/search/plugin': { data: [{ ...ROW, name: 'PickwareErp' }] },
    })
    expect(await outcome).toBeUndefined()
  })
})

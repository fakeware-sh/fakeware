import { describe, expect, test } from 'bun:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { detectPackageManager, installArgs } from './package-manager'

function tmp(): string {
  return mkdtempSync(join(tmpdir(), 'fw-pm-'))
}

describe('detectPackageManager', () => {
  test('prefers an existing lockfile', async () => {
    const dir = tmp()
    await Bun.write(join(dir, 'pnpm-lock.yaml'), '')
    expect(await detectPackageManager(dir, 'npm/10.0.0 node/v22')).toBe('pnpm')
  })

  test('detects bun from the text bun.lock', async () => {
    const dir = tmp()
    await Bun.write(join(dir, 'bun.lock'), '')
    expect(await detectPackageManager(dir, 'npm/10.0.0 node/v22')).toBe('bun')
  })

  test('detects bun from the legacy bun.lockb', async () => {
    const dir = tmp()
    await Bun.write(join(dir, 'bun.lockb'), '')
    expect(await detectPackageManager(dir, 'npm/10.0.0 node/v22')).toBe('bun')
  })

  test('falls back to the user-agent when no lockfile', async () => {
    const dir = tmp()
    expect(await detectPackageManager(dir, 'yarn/4.0.0 node/v22')).toBe('yarn')
  })

  test('defaults to bun when nothing is detectable', async () => {
    const dir = tmp()
    expect(await detectPackageManager(dir, undefined)).toBe('bun')
  })
})

describe('installArgs', () => {
  test('yarn installs with no args', () => {
    expect(installArgs('yarn')).toEqual([])
  })

  test('others use install', () => {
    expect(installArgs('bun')).toEqual(['install'])
    expect(installArgs('npm')).toEqual(['install'])
    expect(installArgs('pnpm')).toEqual(['install'])
  })
})

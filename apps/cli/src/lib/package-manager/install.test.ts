import { describe, expect, test } from 'bun:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { PackageManager } from './detect'
import { runInstall } from './install'

function tmp(): string {
  return mkdtempSync(join(tmpdir(), 'fw-install-'))
}

describe('runInstall', () => {
  test('flags a missing package manager binary as notFound', async () => {
    const missing = 'fw-nonexistent-pm' as PackageManager
    const result = await runInstall(missing, tmp())
    expect(result.ok).toBe(false)
    expect(result.notFound).toBe(true)
  })
})

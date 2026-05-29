import { describe, expect, test } from 'bun:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileExists, isEmptyDir } from './fs'

function tmp(): string {
  return mkdtempSync(join(tmpdir(), 'fw-fs-'))
}

describe('fileExists', () => {
  test('returns true for an existing file', async () => {
    const dir = tmp()
    const path = join(dir, 'present.txt')
    await Bun.write(path, '')
    expect(await fileExists(path)).toBe(true)
  })

  test('returns false for a missing file', async () => {
    const dir = tmp()
    expect(await fileExists(join(dir, 'absent.txt'))).toBe(false)
  })
})

describe('isEmptyDir', () => {
  test('returns true for an empty directory', async () => {
    expect(await isEmptyDir(tmp())).toBe(true)
  })

  test('returns true for a non-existent path', async () => {
    expect(await isEmptyDir(join(tmp(), 'nope'))).toBe(true)
  })

  test('returns false for a directory containing a file', async () => {
    const dir = tmp()
    await Bun.write(join(dir, 'something.txt'), '')
    expect(await isEmptyDir(dir)).toBe(false)
  })
})

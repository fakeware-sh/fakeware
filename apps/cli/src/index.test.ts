import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { EXIT_OK, EXIT_USAGE } from './lib/exit-codes'

const BIN = join(import.meta.dir, '..', 'dist', 'index.mjs')

async function run(...args: string[]): Promise<number> {
  const proc = Bun.spawn(['node', BIN, ...args], { stdout: 'pipe', stderr: 'pipe' })
  return await proc.exited
}

const built = existsSync(BIN)
const it = built ? test : test.skip

describe('fakeware cli exit codes', () => {
  it('exits 0 for --help and --version', async () => {
    expect(await run('--help')).toBe(EXIT_OK)
    expect(await run('--version')).toBe(EXIT_OK)
  })

  it('exits 0 for subcommand help', async () => {
    expect(await run('up', '--help')).toBe(EXIT_OK)
    expect(await run('down', '--help')).toBe(EXIT_OK)
    expect(await run('status', '--help')).toBe(EXIT_OK)
    expect(await run('validate', '--help')).toBe(EXIT_OK)
  })

  it('exits 2 for an unknown command or flag', async () => {
    expect(await run('nosuchcommand')).toBe(EXIT_USAGE)
    expect(await run('--bogus')).toBe(EXIT_USAGE)
  })

  it('exits 2 for an unknown subcommand flag', async () => {
    expect(await run('up', '--bogus')).toBe(EXIT_USAGE)
    expect(await run('down', '--bogus')).toBe(EXIT_USAGE)
    expect(await run('status', '--bogus')).toBe(EXIT_USAGE)
    expect(await run('validate', '--bogus')).toBe(EXIT_USAGE)
  })

  it('exits 2 for an invalid flag value without a stack trace', async () => {
    const proc = Bun.spawn(['node', BIN, 'init', '--secrets', 'nope'], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const code = await proc.exited
    const stderr = await new Response(proc.stderr).text()
    expect(code).toBe(EXIT_USAGE)
    expect(stderr).toContain('Expected one of: env, inline')
    expect(stderr).not.toContain('at ')
  })
})

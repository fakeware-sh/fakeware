import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRegistry } from '../define'
import { createModuleLoader } from '../runtime'
import { evaluateDataFiles } from './evaluate'

const coreIndex = join(import.meta.dir, '..', 'index.ts')

describe('evaluateDataFiles', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'fakeware-evaluate-'))
  })
  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  async function dataFile(name: string, entity: string): Promise<string> {
    const file = join(root, name)
    await writeFile(
      file,
      `import { define } from '${coreIndex}'\ndefine('${entity}', [{ $key: 'a' }])\n`,
    )
    return file
  }

  function entities(drained: { entity: string }[]): string[] {
    return drained.map((e) => e.entity)
  }

  test('each run drains only what its own files defined', async () => {
    const first = await dataFile('first.ts', 'tax')
    const second = await dataFile('second.ts', 'currency')

    const a = await evaluateDataFiles([first], createRegistry(), createModuleLoader())
    const b = await evaluateDataFiles([second], createRegistry(), createModuleLoader())

    expect(entities(a)).toEqual(['tax'])
    expect(entities(b)).toEqual(['currency'])
  })

  test('a fresh registry starts empty even when an earlier run defined records', async () => {
    const first = await dataFile('prior.ts', 'tax')
    await evaluateDataFiles([first], createRegistry(), createModuleLoader())

    const empty = await evaluateDataFiles([], createRegistry(), createModuleLoader())
    expect(empty).toEqual([])
  })

  test('several files in one run drain into a single registry in discovery order', async () => {
    const first = await dataFile('combined-first.ts', 'tax')
    const second = await dataFile('combined-second.ts', 'currency')

    const drained = await evaluateDataFiles([first, second], createRegistry(), createModuleLoader())

    expect(entities(drained)).toEqual(['tax', 'currency'])
  })
})

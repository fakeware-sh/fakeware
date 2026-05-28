import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileExists } from '../utils'
import { FILE_SPECS } from './files'
import type { ScaffoldValues } from './values'

export interface ScaffoldOptions {
  dir: string
  force: boolean
  values: ScaffoldValues
  dryRun?: boolean
}

export interface WrittenFile {
  path: string
  note: string
}

export class ScaffoldError extends Error {}

export async function scaffoldProject(options: ScaffoldOptions): Promise<WrittenFile[]> {
  const { dir, force, values, dryRun = false } = options
  const created: WrittenFile[] = []

  for (const spec of FILE_SPECS) {
    if (!spec.include(values)) continue
    const path = join(dir, spec.name)

    if (spec.strategy === 'fresh') {
      if (!force && !dryRun && (await fileExists(path))) {
        throw new ScaffoldError(`${spec.name} already exists. Re-run with --force to overwrite.`)
      }
      const contents = spec.build?.(values) ?? ''
      if (!dryRun) await writeFile(path, contents)
      created.push({ path, note: spec.note?.(values) ?? '' })
    } else {
      const existing = (await fileExists(path)) ? await readFile(path, 'utf8') : undefined
      const result = spec.merge?.(existing, values)
      if (!result) continue
      if (!dryRun) await writeFile(path, result.contents)
      created.push({ path, note: result.note })
    }
  }

  return created
}

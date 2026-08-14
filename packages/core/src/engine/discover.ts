import { relative } from 'node:path'
import { glob } from 'tinyglobby'
import type { LoadedConfig } from '../config'

const DEFAULT_IGNORE = ['**/node_modules/**', '**/*.test.ts', '**/*.d.ts']

function isInside(root: string, file: string): boolean {
  const rel = relative(root, file)
  return rel !== '' && !rel.startsWith('..')
}

export async function discoverDataFiles(loaded: LoadedConfig): Promise<string[]> {
  const files = await glob(loaded.config.include, {
    cwd: loaded.projectRoot,
    ignore: DEFAULT_IGNORE,
    absolute: true,
    onlyFiles: true,
    dot: false,
  })
  return files.filter((file) => isInside(loaded.projectRoot, file)).sort()
}

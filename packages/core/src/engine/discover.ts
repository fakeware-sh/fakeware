import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

const DATA_DIR = 'data'

function isDataFile(name: string): boolean {
  return name.endsWith('.ts') && !name.endsWith('.test.ts') && !name.endsWith('.d.ts')
}

export async function discoverDataFiles(projectRoot: string): Promise<string[]> {
  const root = join(projectRoot, DATA_DIR)
  let names: string[]
  try {
    names = await readdir(root, { recursive: true })
  } catch {
    return []
  }
  return names
    .filter(isDataFile)
    .sort()
    .map((name) => join(root, name))
}

import { type DrainedEntries, drain, type Registry, runWithRegistry } from '../define'
import type { ModuleLoader } from '../runtime'

export async function evaluateDataFiles(
  files: string[],
  registry: Registry,
  loader: ModuleLoader,
): Promise<DrainedEntries> {
  return runWithRegistry(registry, async () => {
    for (const file of files) {
      await loader.import(file)
    }
    return drain(registry)
  })
}

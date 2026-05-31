import { type DrainedEntries, drain, resetRegistry } from '../define'
import { loadModule } from '../runtime'

export async function evaluateDataFiles(files: string[]): Promise<DrainedEntries> {
  resetRegistry()
  for (const file of files) {
    await loadModule(file)
  }
  return drain()
}

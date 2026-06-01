import { createJiti } from 'jiti'

export class LoadModuleError extends Error {}

const jiti = createJiti(import.meta.url)

export async function loadModule<T = unknown>(absPath: string): Promise<T> {
  try {
    return (await jiti.import(absPath)) as T
  } catch (error) {
    throw new LoadModuleError(
      `Could not load ${absPath}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

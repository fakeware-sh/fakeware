import { pathToFileURL } from 'node:url'

const RUNTIME_TS_HELP =
  'fakeware needs to import your TypeScript files at runtime. Run it under Bun, or with Node >=22.6 (native type stripping), or via a TypeScript loader such as tsx.'

export class LoadModuleError extends Error {}

function isBun(): boolean {
  return typeof (globalThis as { Bun?: unknown }).Bun !== 'undefined'
}

function nodeStripsTypes(): boolean {
  const feature = (process.features as { typescript?: unknown }).typescript
  return feature === 'strip' || feature === 'transform'
}

export async function loadModule<T = unknown>(absPath: string): Promise<T> {
  if (!isBun() && !nodeStripsTypes()) {
    throw new LoadModuleError(RUNTIME_TS_HELP)
  }
  try {
    return (await import(pathToFileURL(absPath).href)) as T
  } catch (error) {
    throw new LoadModuleError(
      `Could not load ${absPath}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

import corePkg from '@fakeware/core/package.json' with { type: 'json' }
import cliPkg from '../../../package.json' with { type: 'json' }
import type { OfficialPlugin } from '../plugins'

const caret = (version: string): string => `^${version}`

export const SCAFFOLD_DEPENDENCIES = {
  '@fakeware/cli': caret(cliPkg.version),
  '@fakeware/core': caret(corePkg.version),
} as const satisfies Record<string, string>

export function scaffoldDependencies(plugins: readonly OfficialPlugin[]): Record<string, string> {
  const deps: Record<string, string> = { ...SCAFFOLD_DEPENDENCIES }
  for (const plugin of plugins) deps[plugin.packageName] = plugin.version
  return deps
}

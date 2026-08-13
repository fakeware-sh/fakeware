import corePkg from '@fakeware/core/package.json' with { type: 'json' }
import rootPkg from '../../../../../package.json' with { type: 'json' }
import cliPkg from '../../../package.json' with { type: 'json' }
import type { OfficialPlugin } from '../plugins'

export const BUN_TYPES_VERSION: string = rootPkg.devDependencies['@types/bun']

export const TYPESCRIPT_VERSION: string = rootPkg.devDependencies.typescript

const caret = (version: string): string => `^${version}`

export const SCAFFOLD_DEPENDENCIES = {
  '@fakeware/cli': caret(cliPkg.version),
  '@fakeware/core': caret(corePkg.version),
} as const satisfies Record<string, string>

export function corePeerRange(): string {
  const [major = '0', minor = '0'] = corePkg.version.split('.')
  const upper = major === '0' ? `0.${Number(minor) + 1}.0` : `${Number(major) + 1}.0.0`
  return `>=${corePkg.version} <${upper}`
}

export function scaffoldDependencies(plugins: readonly OfficialPlugin[]): Record<string, string> {
  const deps: Record<string, string> = { ...SCAFFOLD_DEPENDENCIES }
  for (const plugin of plugins) deps[plugin.packageName] = plugin.version
  return deps
}

import corePkg from '@fakeware/core/package.json' with { type: 'json' }
import cliPkg from '../../../package.json' with { type: 'json' }

const caret = (version: string): string => `^${version}`

export const SCAFFOLD_DEPENDENCIES = {
  '@fakeware/cli': caret(cliPkg.version),
  '@fakeware/core': caret(corePkg.version),
} as const satisfies Record<string, string>

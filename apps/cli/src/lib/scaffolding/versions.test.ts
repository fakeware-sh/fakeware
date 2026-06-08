import { expect, test } from 'bun:test'
import corePkg from '../../../../../packages/core/package.json' with { type: 'json' }
import cliPkg from '../../../package.json' with { type: 'json' }
import { SCAFFOLD_DEPENDENCIES } from './versions'

test('scaffolds each dependency from its OWN package version (no proxying)', () => {
  expect(SCAFFOLD_DEPENDENCIES['@fakeware/core']).toBe(`^${corePkg.version}`)
  expect(SCAFFOLD_DEPENDENCIES['@fakeware/cli']).toBe(`^${cliPkg.version}`)
})

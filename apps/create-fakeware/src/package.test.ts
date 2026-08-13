import { expect, test } from 'bun:test'
import cliPkg from '../../cli/package.json' with { type: 'json' }
import pkg from '../package.json' with { type: 'json' }

test('exposes the create-fakeware bin', () => {
  expect(pkg.bin['create-fakeware']).toBe('./dist/index.mjs')
})

test('depends on the current cli version', () => {
  expect(pkg.dependencies['@fakeware/cli']).toBe(`^${cliPkg.version}`)
})

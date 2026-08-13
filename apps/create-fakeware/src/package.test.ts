import { expect, test } from 'bun:test'
import pkg from '../package.json' with { type: 'json' }

test('exposes the create-fakeware bin', () => {
  expect(pkg.bin['create-fakeware']).toBe('./dist/index.mjs')
})

test('depends on the workspace cli', () => {
  expect(pkg.dependencies['@fakeware/cli']).toBe('workspace:*')
})

import { afterEach, expect, test } from 'bun:test'
import { define } from './define'
import { resetRegistry } from './registry'
import type { EntityName, RecordFor, RegistryEntityName } from './schema'

interface DemoWarehouseRecord {
  $key?: string
  name: string
  code: string
  active?: boolean
}

declare module './schema' {
  interface EntityRegistry {
    demo_warehouse: DemoWarehouseRecord
  }
}

type Expect<T extends true> = T
type Extends<A, B> = A extends B ? true : false

type _registered = Expect<Extends<'demo_warehouse', RegistryEntityName>>
type _notNativeName = Expect<
  Extends<'not_an_entity', EntityName | RegistryEntityName> extends true ? false : true
>
type _completeRecord = Expect<Extends<{ name: string; code: string }, RecordFor<'demo_warehouse'>>>
type _missingRequired = Expect<
  Extends<{ name: string }, RecordFor<'demo_warehouse'>> extends true ? false : true
>

afterEach(() => {
  resetRegistry()
})

test('a registered plugin entity is accepted with the authored shape', () => {
  define('demo_warehouse', { $key: 'main', name: 'Main', code: 'WH-01' })
  define('demo_warehouse', { name: 'Annex', code: 'WH-02', active: true })
  define('demo_warehouse', (ctx) => ({ name: `wh-${ctx.index}`, code: 'WH-X' }))
  define('tax', [{ $key: 'standard', taxRate: 19 }])
  expect(true).toBe(true)
})

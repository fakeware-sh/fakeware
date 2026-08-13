import { expect, test } from 'bun:test'
import { define } from './define'
import { createRegistry, runWithRegistry } from './registry'
import type { RecordExtensions, RecordFor } from './schema'

interface DemoSupplierConfig {
  id?: string
  supplierId: string
  purchase: number
}

declare module './schema' {
  interface RecordExtensions {
    demoSupplierConfigs: DemoSupplierConfig[]
  }
}

type Expect<T extends true> = T
type Extends<A, B> = A extends B ? true : false

type _augmentedKeyIsKnown = Expect<Extends<'demoSupplierConfigs', keyof RecordExtensions>>
type _extensionsSlotExists = Expect<
  Extends<{ extensions?: { demoSupplierConfigs?: DemoSupplierConfig[] } }, RecordFor<'product'>>
>

test('an augmented extensions key is accepted inline on a core record', async () => {
  await runWithRegistry(createRegistry(), async () => {
    const map = define('product', {
      $key: 'demo',
      name: 'Demo',
      extensions: {
        demoSupplierConfigs: [{ id: 'x', supplierId: 's', purchase: 1 }],
      },
    })
    expect(map.demo).toBeDefined()
  })
})

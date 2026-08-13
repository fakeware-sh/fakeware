import { expect, test } from 'bun:test'
import { define } from '@fakeware/core'

type Expect<T extends true> = T
type Extends<A, B> = A extends B ? true : false

type DefineEntity = Parameters<typeof define>[0]

type _binLocationIsKnown = Expect<Extends<'pickware_erp_bin_location', DefineEntity>>
type _supplierIsKnown = Expect<Extends<'pickware_erp_supplier', DefineEntity>>
type _returnOrderIsKnown = Expect<Extends<'pickware_erp_return_order', DefineEntity>>
type _stockMovementRejected = Expect<
  Extends<'pickware_erp_stock_movement', DefineEntity> extends true ? false : true
>
type _unknownEntityRejected = Expect<
  Extends<'pickware_erp_not_real', DefineEntity> extends true ? false : true
>

export type _Checks = [
  _binLocationIsKnown,
  _supplierIsKnown,
  _returnOrderIsKnown,
  _stockMovementRejected,
  _unknownEntityRejected,
]

test('bin locations are accepted by define() with their authored shape', () => {
  define('pickware_erp_bin_location', [{ $key: 'a1', code: 'A1', warehouseId: 'wh-id' }])
  expect(true).toBe(true)
})

test('suppliers are accepted by define() with their authored shape', () => {
  define('pickware_erp_supplier', [
    { $key: 's1', number: 'SUP-1', name: 'ACME', languageId: 'lang' },
  ])
  expect(true).toBe(true)
})

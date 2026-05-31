import { beforeEach, describe, expect, test } from 'bun:test'
import { define, drain, ref, resetRegistry, setActiveRefIndex } from '../define'
import { buildWritePlan } from './build-graph'
import { GraphError } from './errors'

beforeEach(() => {
  resetRegistry()
  setActiveRefIndex(undefined)
})

describe('buildWritePlan', () => {
  test('orders a referenced entity before its referrer', () => {
    define('product', { $key: 'hero', taxId: () => ref('tax/standard') })
    define('tax', [{ $key: 'standard', taxRate: 19 }])
    const plan = buildWritePlan(drain())
    expect(plan.order.indexOf('tax')).toBeLessThan(plan.order.indexOf('product'))
  })

  test('resolves payloads and injects ids', () => {
    define('tax', [{ $key: 'standard', taxRate: 19 }])
    const plan = buildWritePlan(drain())
    const record = plan.records.get('tax')?.[0]
    expect(record?.taxRate).toBe(19)
    expect(record?.id).toMatch(/^[0-9a-f]{32}$/)
    expect(record).not.toHaveProperty('$key')
  })

  test('ignores self-referential entities (same batch)', () => {
    define('category', [{ $key: 'root' }, { $key: 'child', parentId: () => ref('category/root') }])
    const plan = buildWritePlan(drain())
    expect(plan.order).toEqual(['category'])
  })

  test('throws GraphError on a reference cycle', () => {
    define('product', { $key: 'x', cmsPageId: () => ref('category/y') })
    define('category', { $key: 'y', cmsPageId: () => ref('product/x') })
    expect(() => buildWritePlan(drain())).toThrow(GraphError)
  })
})

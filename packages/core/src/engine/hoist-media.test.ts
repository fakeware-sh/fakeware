import { describe, expect, test } from 'bun:test'
import { MEDIA_UPLOAD_KEY, media } from '../contract/media'
import { createRegistry, define, deterministicId, drain, ref, runWithRegistry } from '../define'
import { fakeShopContext } from '../testing/fake-shop-context'
import { buildWritePlan, type WritePlan } from './build-graph'

const shopContext = fakeShopContext({})

function plan(fn: () => void): Promise<WritePlan> {
  return runWithRegistry(createRegistry(), async () => {
    fn()
    return buildWritePlan(drain(), shopContext)
  })
}

interface ProductMedia {
  id: string
  mediaId: string
  position: number
}

function productMedia(entity: string, ownerKey: string, slot: string): string {
  return deterministicId('product_media', `${entity}:${ownerKey}:${slot}`)
}

describe('inline cover/gallery hoisting', () => {
  test('hoists a literal cover into the media entity and wires coverId', async () => {
    const result = await plan(() => {
      define('product', {
        $key: 'pot',
        name: 'Pot',
        cover: media({ url: 'https://x.test/pot.jpg', alt: 'Pot' }),
      })
    })

    const product = result.records.get('product')?.[0]?.record as Record<string, unknown>
    expect(product).not.toHaveProperty('cover')
    expect(product).not.toHaveProperty('gallery')

    const mediaRows = product.media as ProductMedia[]
    expect(mediaRows).toHaveLength(1)
    const coverMediaId = deterministicId('media', 'product:pot:cover')
    expect(mediaRows[0]?.mediaId).toBe(coverMediaId)
    expect(mediaRows[0]?.position).toBe(0)
    expect(product.coverId).toBe(productMedia('product', 'pot', 'cover'))

    const mediaBucket = result.records.get('media') ?? []
    expect(mediaBucket).toHaveLength(1)
    const mediaRecord = mediaBucket[0]?.record as Record<string, unknown>
    expect(mediaRecord.id).toBe(coverMediaId)
    expect(mediaRecord[MEDIA_UPLOAD_KEY]).toBeDefined()
    expect(mediaRecord.alt).toBe('Pot')
  })

  test('orders the media entity before its owner', async () => {
    const result = await plan(() => {
      define('product', {
        $key: 'pot',
        cover: media({ url: 'https://x.test/pot.jpg' }),
      })
    })
    expect(result.order.indexOf('media')).toBeLessThan(result.order.indexOf('product'))
  })

  test('cover comes first, then gallery, in position order', async () => {
    const result = await plan(() => {
      define('product', {
        $key: 'shirt',
        cover: media({ url: 'https://x.test/front.jpg' }),
        gallery: [
          media({ url: 'https://x.test/back.jpg' }),
          media({ url: 'https://x.test/side.jpg' }),
        ],
      })
    })
    const rows = (result.records.get('product')?.[0]?.record.media as ProductMedia[]) ?? []
    expect(rows.map((r) => r.position)).toEqual([0, 1, 2])
    expect(rows[0]?.mediaId).toBe(deterministicId('media', 'product:shirt:cover'))
    expect(rows[1]?.mediaId).toBe(deterministicId('media', 'product:shirt:0'))
    expect(rows[2]?.mediaId).toBe(deterministicId('media', 'product:shirt:1'))
    expect(result.records.get('media')).toHaveLength(3)
  })

  test('gallery without cover makes the first entry the cover', async () => {
    const result = await plan(() => {
      define('product', {
        $key: 'shirt',
        gallery: [media({ url: 'https://x.test/a.jpg' }), media({ url: 'https://x.test/b.jpg' })],
      })
    })
    const product = result.records.get('product')?.[0]?.record as Record<string, unknown>
    const rows = product.media as ProductMedia[]
    expect(product.coverId).toBe(rows[0]?.id)
    expect(rows[0]?.mediaId).toBe(deterministicId('media', 'product:shirt:0'))
  })

  test('is idempotent — same input yields identical ids and hashes', async () => {
    const build = () =>
      plan(() => {
        define('product', {
          $key: 'pot',
          cover: media({ url: 'https://x.test/pot.jpg', alt: 'Pot' }),
        })
      })
    const a = await build()
    const b = await build()
    expect(a.records.get('media')?.[0]?.hash).toBe(b.records.get('media')?.[0]?.hash as string)
    expect(a.records.get('product')?.[0]?.hash).toBe(b.records.get('product')?.[0]?.hash as string)
  })

  test('distinct products get distinct hoisted media ids', async () => {
    const result = await plan(() => {
      define('product', [
        { $key: 'a', cover: media({ url: 'https://x.test/a.jpg' }) },
        { $key: 'b', cover: media({ url: 'https://x.test/b.jpg' }) },
      ])
    })
    const ids = (result.records.get('media') ?? []).map((r) => r.record.id)
    expect(new Set(ids).size).toBe(2)
    expect(ids).toContain(deterministicId('media', 'product:a:cover'))
    expect(ids).toContain(deterministicId('media', 'product:b:cover'))
  })

  test('an explicit $key on the inline media wins', async () => {
    const result = await plan(() => {
      define('product', {
        $key: 'pot',
        cover: media({ $key: 'shared-hero', url: 'https://x.test/pot.jpg' }),
      })
    })
    const mediaId = deterministicId('media', 'shared-hero')
    expect(result.records.get('media')?.[0]?.record.id).toBe(mediaId)
    const rows = result.records.get('product')?.[0]?.record.media as ProductMedia[]
    expect(rows[0]?.mediaId).toBe(mediaId)
  })

  test('a ref in cover resolves without hoisting', async () => {
    const result = await plan(() => {
      define('media', [media({ $key: 'logo', url: 'https://x.test/logo.png' })])
      define('product', { $key: 'pot', cover: ref('media').key('logo') })
    })

    expect(result.records.get('media')).toHaveLength(1)
    const rows = result.records.get('product')?.[0]?.record.media as ProductMedia[]
    expect(rows[0]?.mediaId).toBe(deterministicId('media', 'logo'))
  })

  test('a shared media literal reused across products is written once', async () => {
    const result = await plan(() => {
      define('product', [
        { $key: 'a', cover: media({ $key: 'shared', url: 'https://x.test/s.jpg' }) },
        { $key: 'b', cover: media({ $key: 'shared', url: 'https://x.test/s.jpg' }) },
      ])
    })
    expect(result.records.get('media')).toHaveLength(1)
  })

  test('two products sharing a source file get distinct, unique file names', async () => {
    const result = await plan(() => {
      define('product', [
        { $key: 'a', cover: media({ file: './assets/shirt.jpg' }) },
        { $key: 'b', cover: media({ file: './assets/shirt.jpg' }) },
      ])
    })
    const rows = result.records.get('media') ?? []
    expect(rows).toHaveLength(2)
    const fileNames = rows.map((r) => (r.record[MEDIA_UPLOAD_KEY] as { fileName: string }).fileName)
    expect(new Set(fileNames).size).toBe(2)
    for (const r of rows) {
      const fn = (r.record[MEDIA_UPLOAD_KEY] as { fileName: string }).fileName
      expect(fn.endsWith(String(r.record.id).slice(0, 8))).toBe(true)
    }
  })

  test('merges hoisted media with an author-defined media entity', async () => {
    const result = await plan(() => {
      define('media', [media({ $key: 'logo', url: 'https://x.test/logo.png' })])
      define('product', { $key: 'pot', cover: media({ url: 'https://x.test/pot.jpg' }) })
    })
    const ids = (result.records.get('media') ?? []).map((r) => r.record.id)
    expect(ids).toContain(deterministicId('media', 'logo'))
    expect(ids).toContain(deterministicId('media', 'product:pot:cover'))
    expect(ids).toHaveLength(2)
  })
})

import { describe, expect, test } from 'bun:test'
import { isShopToken } from '../define/tokens'
import { MEDIA_UPLOAD_KEY, media } from './media'

describe('media()', () => {
  test('requires exactly one of url or file', () => {
    expect(() => media({ url: 'https://x.test/a.png', file: './a.png' })).toThrow(/exactly one of/)
    expect(() => media({ alt: 'nothing' })).toThrow(/exactly one of/)
  })

  test('derives the extension from a url and carries the source', () => {
    const rec = media({ $key: 'hoodie', url: 'https://picsum.photos/seed/hoodie/800.jpg' })
    expect(rec[MEDIA_UPLOAD_KEY].extension).toBe('jpg')
    expect(rec[MEDIA_UPLOAD_KEY].source).toEqual({
      url: 'https://picsum.photos/seed/hoodie/800.jpg',
    })
  })

  test('derives the extension from a local file path', () => {
    const rec = media({ $key: 'sticker', file: './assets/sticker.PNG' })
    expect(rec[MEDIA_UPLOAD_KEY].extension).toBe('png')
    expect(rec[MEDIA_UPLOAD_KEY].source).toEqual({ file: './assets/sticker.PNG' })
  })

  test('an explicit extension wins over an ambiguous url', () => {
    const rec = media({ url: 'https://x.test/download?id=42', extension: 'webp' })
    expect(rec[MEDIA_UPLOAD_KEY].extension).toBe('webp')
  })

  test('throws when the extension cannot be determined', () => {
    expect(() => media({ url: 'https://x.test/download?id=42' })).toThrow(/file extension/)
  })

  test('produces a deterministic, unique fileName per $key', () => {
    const a = media({ $key: 'hoodie', url: 'https://x.test/a.png' })
    const again = media({ $key: 'hoodie', url: 'https://x.test/a.png' })
    const other = media({ $key: 'sticker', url: 'https://x.test/a.png' })
    expect(a[MEDIA_UPLOAD_KEY].fileName).toBe(again[MEDIA_UPLOAD_KEY].fileName)
    expect(a[MEDIA_UPLOAD_KEY].fileName).not.toBe(other[MEDIA_UPLOAD_KEY].fileName)
  })

  test('defaults mediaFolderId to the product media folder shop token', () => {
    const rec = media({ url: 'https://x.test/a.png' })
    expect(isShopToken(rec.mediaFolderId)).toBe(true)
  })

  test('passes through alt/title/private and an explicit folder', () => {
    const rec = media({
      url: 'https://x.test/a.png',
      alt: 'Alt',
      title: 'Title',
      private: true,
      mediaFolderId: 'folder-1',
    })
    expect(rec.alt).toBe('Alt')
    expect(rec.title).toBe('Title')
    expect(rec.private).toBe(true)
    expect(rec.mediaFolderId).toBe('folder-1')
  })
})

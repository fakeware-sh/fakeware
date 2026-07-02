import { deterministicId } from '../define/ids'
import { isPlainObject } from '../define/is-plain-object'
import type { SinkRecord } from '../domain'
import { MEDIA_UPLOAD_KEY } from '../shopware/media'

export const MEDIA_ENTITY = 'media'

interface ProductMediaAssoc {
  id: string
  mediaId: string
  position: number
}

export interface HoistedMedia {
  id: string
  record: SinkRecord
  canonical: Record<string, unknown>
}

interface Resolved {
  value: Record<string, unknown>
  canonical: Record<string, unknown>
}

function isMediaLiteral(value: unknown): value is Record<string, unknown> {
  return isPlainObject(value) && MEDIA_UPLOAD_KEY in value
}

function slotList(value: unknown): unknown[] {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

function slotName(field: 'cover' | 'gallery', index: number): string {
  return field === 'cover' ? 'cover' : String(index)
}

function mediaIdFor(
  entity: string,
  ownerKey: string,
  slot: string,
  literal: Record<string, unknown>,
): string {
  const explicit = literal.$key
  if (typeof explicit === 'string' && explicit.length > 0) {
    return deterministicId(MEDIA_ENTITY, explicit)
  }
  return deterministicId(MEDIA_ENTITY, `${entity}:${ownerKey}:${slot}`)
}

function withUniqueFileName(record: Record<string, unknown>, id: string): Record<string, unknown> {
  const spec = record[MEDIA_UPLOAD_KEY]
  if (!spec || typeof spec !== 'object') return record
  const { fileName } = spec as { fileName?: string }
  if (typeof fileName !== 'string') return record
  const stem = fileName.includes('-') ? fileName.slice(0, fileName.lastIndexOf('-')) : fileName
  return {
    ...record,
    [MEDIA_UPLOAD_KEY]: { ...(spec as object), fileName: `${stem}-${id.slice(0, 8)}` },
  }
}

function toMediaRecord(literal: Record<string, unknown>, id: string): SinkRecord {
  const { $key: _key, ...rest } = literal
  return { ...withUniqueFileName(rest, id), id }
}

function toMediaCanonical(canonical: Record<string, unknown>, id: string): Record<string, unknown> {
  const { $key: _key, ...rest } = canonical
  return withUniqueFileName(rest, id)
}

export interface HoistResult {
  media: HoistedMedia[]
}

export function hoistMedia(entity: string, ownerKey: string, resolved: Resolved): HoistResult {
  const { value, canonical } = resolved
  const hasCover = 'cover' in value
  const hasGallery = 'gallery' in value
  if (!hasCover && !hasGallery) return { media: [] }

  const hoisted: HoistedMedia[] = []
  const assoc: ProductMediaAssoc[] = []
  let position = 0

  const consume = (field: 'cover' | 'gallery'): void => {
    const values = slotList(value[field])
    const canons = slotList(canonical[field])
    values.forEach((entry, index) => {
      const slot = slotName(field, index)
      let mediaId: string
      if (isMediaLiteral(entry)) {
        const canonEntry = (canons[index] ?? entry) as Record<string, unknown>
        mediaId = mediaIdFor(entity, ownerKey, slot, entry)
        hoisted.push({
          id: mediaId,
          record: toMediaRecord(entry, mediaId),
          canonical: toMediaCanonical(canonEntry, mediaId),
        })
      } else if (typeof entry === 'string') {
        mediaId = entry
      } else {
        return
      }
      const assocId = deterministicId('product_media', `${entity}:${ownerKey}:${slot}`)
      assoc.push({ id: assocId, mediaId, position: position++ })
    })
  }

  if (hasCover) consume('cover')
  if (hasGallery) consume('gallery')

  delete value.cover
  delete value.gallery
  delete canonical.cover
  delete canonical.gallery

  if (assoc.length > 0) {
    const existing = Array.isArray(value.media) ? (value.media as ProductMediaAssoc[]) : []
    const mediaList = [...assoc, ...existing]
    value.media = mediaList
    canonical.media = mediaList
    const coverId = assoc[0]?.id
    if (coverId !== undefined) {
      value.coverId = coverId
      canonical.coverId = coverId
    }
  }

  return { media: hoisted }
}

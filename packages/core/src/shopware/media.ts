import slugify from 'slugify'
import { deterministicId } from '../define/ids'
import type { AnyToken } from '../define/tokens'
import { shop } from './shop-context'

export const MEDIA_UPLOAD_KEY = '__fakewareMedia'

export interface MediaUrlSource {
  url: string
}

export interface MediaFileSource {
  file: string
}

export type MediaSource = MediaUrlSource | MediaFileSource

export interface MediaUploadSpec {
  extension: string
  fileName: string
  source: MediaSource
}

export interface MediaInput {
  $key?: string
  url?: string
  file?: string
  alt?: string
  title?: string
  fileName?: string
  extension?: string
  mimeType?: string
  private?: boolean
  mediaFolderId?: string | AnyToken
}

export interface MediaRecord {
  $key?: string
  alt?: string
  title?: string
  private?: boolean
  mediaFolderId?: string | AnyToken
  [MEDIA_UPLOAD_KEY]: MediaUploadSpec
}

function lastSegment(path: string): string {
  const clean = path.split(/[?#]/)[0] ?? path
  const slash = clean.lastIndexOf('/')
  return slash === -1 ? clean : clean.slice(slash + 1)
}

function extensionFromPath(path: string): string | undefined {
  const name = lastSegment(path)
  const dot = name.lastIndexOf('.')
  if (dot <= 0 || dot === name.length - 1) return undefined
  return name.slice(dot + 1).toLowerCase()
}

function baseNameFromPath(path: string): string {
  const name = lastSegment(path)
  const dot = name.lastIndexOf('.')
  const stem = dot <= 0 ? name : name.slice(0, dot)
  return stem || 'media'
}

function fileNameSlug(value: string): string {
  return slugify(value, { lower: true, strict: true }) || 'media'
}

export function media(input: MediaInput): MediaRecord {
  const hasUrl = typeof input.url === 'string' && input.url.length > 0
  const hasFile = typeof input.file === 'string' && input.file.length > 0
  if (hasUrl === hasFile) {
    throw new Error("media() requires exactly one of 'url' or 'file'.")
  }

  const path = (hasUrl ? input.url : input.file) as string
  const extension = input.extension ?? extensionFromPath(path)
  if (!extension) {
    throw new Error(
      `media(${JSON.stringify(path)}) could not determine a file extension. Pass 'extension' explicitly.`,
    )
  }

  const source: MediaSource = hasUrl ? { url: path } : { file: path }
  const stem = input.fileName ? fileNameSlug(input.fileName) : fileNameSlug(baseNameFromPath(path))
  const uniqueSuffix = deterministicId('media', input.$key ?? path).slice(0, 8)
  const fileName = `${stem}-${uniqueSuffix}`

  const record: MediaRecord = {
    [MEDIA_UPLOAD_KEY]: { extension: extension.toLowerCase(), fileName, source },
  }
  if (input.$key !== undefined) record.$key = input.$key
  if (input.alt !== undefined) record.alt = input.alt
  if (input.title !== undefined) record.title = input.title
  if (input.private !== undefined) record.private = input.private
  record.mediaFolderId = input.mediaFolderId ?? shop.mediaFolder('product')

  return record
}

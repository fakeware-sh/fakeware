import { createHash } from 'node:crypto'
import { isPlainObject } from './is-plain-object'

const FAKEWARE_NAMESPACE = 'b1e0a3f4-6c2d-5a8b-9e7f-0d1c2b3a4e5f'

function uuidBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, '')
  const bytes = new Uint8Array(16)
  for (let i = 0; i < 16; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

const NAMESPACE_BYTES = uuidBytes(FAKEWARE_NAMESPACE)

function uuidv5(name: string): string {
  const hash = createHash('sha1')
  hash.update(NAMESPACE_BYTES)
  hash.update(name, 'utf8')
  const digest = hash.digest()

  const bytes = digest.subarray(0, 16)
  bytes[6] = ((bytes[6] as number) & 0x0f) | 0x50
  bytes[8] = ((bytes[8] as number) & 0x3f) | 0x80

  return bytes.toString('hex')
}

export function deterministicId(entity: string, key: string): string {
  return uuidv5(`${entity}:${key}`)
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (isPlainObject(value)) {
    const sorted: Record<string, unknown> = {}
    for (const k of Object.keys(value).sort()) {
      sorted[k] = canonicalize(value[k])
    }
    return sorted
  }
  return value
}

export function recordHash(payload: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(payload)))
    .digest('hex')
}

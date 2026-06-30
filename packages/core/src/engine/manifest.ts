import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { ConfigError } from '../config'

const MANIFEST_DIR = '.fakeware'
const CURRENT_VERSION = 2 as const

function shopKey(shopwareUrl: string): string {
  return createHash('sha256').update(shopwareUrl).digest('hex').slice(0, 16)
}

export interface ManifestRecord {
  id: string
  hash: string
}

export interface ManifestEntity {
  entity: string
  records: ManifestRecord[]
  pending?: boolean
}

export interface Manifest {
  version: 2
  fakewareVersion: string
  createdAt: string
  shopwareUrl: string
  entities: ManifestEntity[]
  checksum: string
}

export function manifestPath(projectRoot: string, shopwareUrl: string): string {
  return join(projectRoot, MANIFEST_DIR, `${shopKey(shopwareUrl)}.json`)
}

function checksumOf(entities: ManifestEntity[]): string {
  const canonical = entities
    .map((e) => ({
      entity: e.entity,
      records: [...e.records].sort((a, b) => a.id.localeCompare(b.id)),
    }))
    .sort((a, b) => a.entity.localeCompare(b.entity))
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
}

export interface BuildManifestInput {
  fakewareVersion: string
  createdAt: string
  shopwareUrl: string
  entities: ManifestEntity[]
}

export function buildManifest(input: BuildManifestInput): Manifest {
  return {
    version: CURRENT_VERSION,
    fakewareVersion: input.fakewareVersion,
    createdAt: input.createdAt,
    shopwareUrl: input.shopwareUrl,
    entities: input.entities,
    checksum: checksumOf(input.entities),
  }
}

export async function readManifest(
  projectRoot: string,
  shopwareUrl: string,
): Promise<Manifest | null> {
  const path = manifestPath(projectRoot, shopwareUrl)
  let contents: string
  try {
    contents = await readFile(path, 'utf8')
  } catch {
    return null
  }
  const parsed = JSON.parse(contents) as { version?: number }
  switch (parsed.version) {
    case CURRENT_VERSION: {
      const manifest = parsed as Manifest
      if (checksumOf(manifest.entities) !== manifest.checksum) {
        throw new ConfigError(`Manifest at ${path} is corrupt (checksum mismatch).`)
      }
      return manifest
    }
    default:
      throw new ConfigError(
        `Manifest at ${path} uses version ${parsed.version}, but this fakeware reads version ${CURRENT_VERSION}.`,
      )
  }
}

export async function writeManifest(projectRoot: string, manifest: Manifest): Promise<void> {
  const path = manifestPath(projectRoot, manifest.shopwareUrl)
  await mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.${process.pid}.tmp`
  await writeFile(tmp, `${JSON.stringify(manifest, null, 2)}\n`)
  await rename(tmp, path)
}

export async function removeManifest(projectRoot: string, shopwareUrl: string): Promise<void> {
  await rm(manifestPath(projectRoot, shopwareUrl), { force: true })
}

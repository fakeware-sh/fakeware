import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { z } from 'zod'
import { ConfigError } from '../config'

const MANIFEST_DIR = '.fakeware'
const CURRENT_VERSION = 2 as const

function shopKey(shopwareUrl: string): string {
  return createHash('sha256').update(shopwareUrl).digest('hex').slice(0, 16)
}

const manifestRecordSchema = z.object({
  id: z.string(),
  hash: z.string(),
})

const manifestEntitySchema = z.object({
  entity: z.string(),
  records: z.array(manifestRecordSchema),
  pending: z.boolean().optional(),
})

const manifestSchema = z.object({
  version: z.literal(CURRENT_VERSION),
  fakewareVersion: z.string(),
  createdAt: z.string(),
  shopwareUrl: z.string(),
  entities: z.array(manifestEntitySchema),
  checksum: z.string(),
})

export type ManifestRecord = z.output<typeof manifestRecordSchema>

export type ManifestEntity = z.output<typeof manifestEntitySchema>

export type Manifest = z.output<typeof manifestSchema>

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
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
  let raw: unknown
  try {
    raw = JSON.parse(contents)
  } catch {
    throw new ConfigError(`Manifest at ${path} is not valid JSON.`)
  }
  if (typeof raw !== 'object' || raw === null) {
    throw new ConfigError(`Manifest at ${path} is not a JSON object.`)
  }
  const { version } = raw as { version?: unknown }
  if (version !== CURRENT_VERSION) {
    throw new ConfigError(
      `Manifest at ${path} uses version ${version}, but this fakeware reads version ${CURRENT_VERSION}.`,
    )
  }
  const parsed = manifestSchema.safeParse(raw)
  if (!parsed.success) {
    throw new ConfigError(`Manifest at ${path} has an unexpected shape: ${parsed.error.message}`)
  }
  const manifest = parsed.data
  if (checksumOf(manifest.entities) !== manifest.checksum) {
    throw new ConfigError(`Manifest at ${path} is corrupt (checksum mismatch).`)
  }
  return manifest
}

export async function writeManifest(projectRoot: string, manifest: Manifest): Promise<void> {
  const path = manifestPath(projectRoot, manifest.shopwareUrl)
  await mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.${process.pid}.tmp`
  await writeFile(tmp, `${JSON.stringify(manifest, null, 2)}\n`)
  try {
    await rename(tmp, path)
  } catch (error) {
    await rm(tmp, { force: true })
    throw error
  }
}

export async function removeManifest(projectRoot: string, shopwareUrl: string): Promise<void> {
  await rm(manifestPath(projectRoot, shopwareUrl), { force: true })
}

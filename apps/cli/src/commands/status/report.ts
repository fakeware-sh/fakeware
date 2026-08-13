import type { Manifest } from '@fakeware/core'

export interface StatusEntity {
  entity: string
  records: number
  pending: boolean
}

export interface StatusReport {
  shopwareUrl: string
  configPath: string
  plugins: string[]
  manifest: {
    createdAt: string
    fakewareVersion: string
    version: number
    records: number
    entities: StatusEntity[]
  } | null
}

export function toStatusEntities(manifest: Manifest): StatusEntity[] {
  return manifest.entities
    .map((entity) => ({
      entity: entity.entity,
      records: entity.records.length,
      pending: entity.pending === true,
    }))
    .sort((a, b) => a.entity.localeCompare(b.entity))
}

export function totalRecords(entities: StatusEntity[]): number {
  return entities.reduce((sum, entity) => sum + entity.records, 0)
}

export function buildReport(
  input: { shopwareUrl: string; configPath: string; plugins: string[] },
  manifest: Manifest | null,
): StatusReport {
  if (!manifest) return { ...input, manifest: null }
  const entities = toStatusEntities(manifest)
  return {
    ...input,
    manifest: {
      createdAt: manifest.createdAt,
      fakewareVersion: manifest.fakewareVersion,
      version: manifest.version,
      records: totalRecords(entities),
      entities,
    },
  }
}

export function pendingEntities(report: StatusReport): string[] {
  if (!report.manifest) return []
  return report.manifest.entities.filter((e) => e.pending).map((e) => e.entity)
}

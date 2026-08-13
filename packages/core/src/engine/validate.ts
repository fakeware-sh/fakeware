import type { LoadedConfig } from '../config'
import type { ShopContext, ShopContextIndex } from '../contract'
import { createRegistry, RefError } from '../define'
import { createModuleLoader, LoadModuleError } from '../runtime'
import { buildWritePlan } from './build-graph'
import { discoverDataFiles } from './discover'
import { GraphError } from './errors'
import { evaluateDataFiles } from './evaluate'

export type ValidateCheck = 'dataFiles' | 'definitions' | 'references' | 'graph'

export interface ValidateIssue {
  check: ValidateCheck
  message: string
}

export interface ValidateResult {
  ok: boolean
  dataFiles: string[]
  entities: string[]
  records: number
  issues: ValidateIssue[]
  shopDependent: string | null
}

const PLACEHOLDER = '00000000000000000000000000000000'

const PLACEHOLDER_ENTRY = {
  id: PLACEHOLDER,
  name: PLACEHOLDER,
  technicalName: PLACEHOLDER,
  isoCode: PLACEHOLDER,
  locale: PLACEHOLDER,
  taxRate: 0,
}

function alwaysFound(): Map<unknown, unknown> {
  const map = new Map<unknown, unknown>()
  map.get = () => PLACEHOLDER_ENTRY
  return map
}

function placeholderShopContext(): ShopContext {
  const index = new Proxy({} as ShopContextIndex, {
    get: (_target, property) =>
      String(property).endsWith('Default') ? PLACEHOLDER_ENTRY : alwaysFound(),
  })
  return new Proxy({} as ShopContext, {
    get: (_target, property) => (property === 'index' ? index : []),
  })
}

function classify(error: unknown): ValidateCheck | null {
  if (error instanceof RefError) return 'references'
  if (error instanceof GraphError) return 'graph'
  if (error instanceof LoadModuleError) return 'dataFiles'
  return null
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function issueFrom(error: unknown, fallback: ValidateCheck): ValidateIssue {
  return { check: classify(error) ?? fallback, message: messageOf(error) }
}

export async function validateProject(loaded: LoadedConfig): Promise<ValidateResult> {
  const empty = { entities: [] as string[], records: 0, shopDependent: null }
  const dataFiles = await discoverDataFiles(loaded.projectRoot)
  if (dataFiles.length === 0) {
    return { ok: true, dataFiles, ...empty, issues: [] }
  }

  let drained: Awaited<ReturnType<typeof evaluateDataFiles>>
  try {
    drained = await evaluateDataFiles(dataFiles, createRegistry(), createModuleLoader())
  } catch (error) {
    return { ok: false, dataFiles, ...empty, issues: [issueFrom(error, 'dataFiles')] }
  }

  const entities = drained.map((d) => d.entity)
  const records = drained.reduce((sum, d) => sum + d.entries.length, 0)
  const base = { dataFiles, entities, records }

  try {
    buildWritePlan(drained, placeholderShopContext())
  } catch (error) {
    const check = classify(error)
    if (check === null) {
      return { ok: true, ...base, issues: [], shopDependent: messageOf(error) }
    }
    return {
      ok: false,
      ...base,
      issues: [{ check, message: messageOf(error) }],
      shopDependent: null,
    }
  }

  return { ok: true, ...base, issues: [], shopDependent: null }
}

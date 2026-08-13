import type { ValidateCheck, ValidateResult } from '@fakeware/core'
import pc from 'picocolors'

const LABELS: Record<ValidateCheck, string> = {
  dataFiles: 'Data files',
  definitions: 'Definitions',
  references: 'References',
  graph: 'Dependency graph',
}

const ORDER: ValidateCheck[] = ['dataFiles', 'definitions', 'references', 'graph']

function summarise(result: ValidateResult, check: ValidateCheck): string {
  if (check === 'dataFiles') {
    const n = result.dataFiles.length
    return n === 0 ? 'no data files found' : `${n} ${n === 1 ? 'file' : 'files'}`
  }
  if (check === 'definitions') {
    const n = result.records
    return `${result.entities.length} entities, ${n} ${n === 1 ? 'record' : 'records'}`
  }
  return 'resolved'
}

export function renderChecklist(result: ValidateResult): string {
  const failed = new Set(result.issues.map((issue) => issue.check))
  const lines: string[] = []
  let blocked = false

  for (const check of ORDER) {
    const label = LABELS[check]
    if (failed.has(check)) {
      lines.push(`${pc.red('✖')} ${label}`)
      blocked = true
      continue
    }
    if (blocked) {
      lines.push(`${pc.dim('•')} ${pc.dim(`${label}: not checked`)}`)
      continue
    }
    if (check !== 'dataFiles' && result.dataFiles.length === 0) {
      lines.push(`${pc.dim('•')} ${pc.dim(`${label}: nothing to check`)}`)
      continue
    }
    if (check !== 'dataFiles' && check !== 'definitions' && result.shopDependent !== null) {
      lines.push(`${pc.yellow('~')} ${label} ${pc.dim('needs the shop')}`)
      continue
    }
    lines.push(`${pc.green('✔')} ${label} ${pc.dim(summarise(result, check))}`)
  }

  return lines.join('\n')
}

export function renderIssues(result: ValidateResult): string {
  return result.issues
    .map((issue) => `${pc.cyan(LABELS[issue.check])}\n${pc.red('-')} ${issue.message.trim()}`)
    .join('\n\n')
}

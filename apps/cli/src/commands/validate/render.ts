import type { ValidateCheck, ValidateResult } from '@fakeware/core'
import pc from 'picocolors'

const LABELS: Record<ValidateCheck, string> = {
  plugins: 'Plugin checks',
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

function pluginRow(result: ValidateResult): string | null {
  const label = LABELS.plugins
  if (result.issues.some((issue) => issue.check === 'plugins')) {
    return `${pc.red('✖')} ${label}`
  }
  if (result.checksSkipped > 0) {
    const reason =
      result.skipReason === 'noConnection' ? 'no shop configured' : 'skipped with --no-shop-checks'
    return `${pc.yellow('~')} ${label} ${pc.dim(reason)}`
  }
  const n = result.checks.length
  if (n === 0) return null
  return `${pc.green('✔')} ${label} ${pc.dim(`${n} ${n === 1 ? 'check' : 'checks'} passed`)}`
}

export function renderChecklist(result: ValidateResult): string {
  const failed = new Set(result.issues.map((issue) => issue.check))
  const lines: string[] = []
  let blocked = false

  const plugins = pluginRow(result)
  if (plugins !== null) lines.push(plugins)

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

export function renderCheckWarnings(result: ValidateResult): string {
  return result.checks
    .filter((report) => report.level === 'warn')
    .map((report) => {
      const hint = report.hint ? `\n${pc.dim(report.hint)}` : ''
      return `${pc.cyan(report.plugin)}\n${pc.yellow('-')} ${report.message.trim()}${hint}`
    })
    .join('\n\n')
}

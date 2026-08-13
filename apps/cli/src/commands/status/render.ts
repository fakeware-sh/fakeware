import pc from 'picocolors'
import type { StatusEntity, StatusReport } from './report'

function pad(value: string, width: number): string {
  return value.padEnd(width)
}

export function renderSummary(report: StatusReport): string {
  const rows: [string, string][] = [
    ['Shop', pc.cyan(report.shopwareUrl)],
    ['Config', pc.dim(report.configPath)],
  ]
  if (report.plugins.length > 0) rows.push(['Plugins', report.plugins.join(', ')])
  if (report.manifest) {
    rows.push(['Applied', report.manifest.createdAt])
    rows.push(['By', `fakeware ${report.manifest.fakewareVersion}`])
  }
  const width = Math.max(...rows.map(([label]) => label.length))
  return rows.map(([label, value]) => `${pc.dim(pad(label, width))}  ${value}`).join('\n')
}

function entityLine(entity: StatusEntity, width: number): string {
  const records = `${entity.records} ${entity.records === 1 ? 'record' : 'records'}`
  const flag = entity.pending ? ` ${pc.yellow('pending')}` : ''
  return `${pc.cyan(pad(entity.entity, width))}  ${pc.dim(records)}${flag}`
}

export function renderEntities(entities: StatusEntity[]): string {
  const width = Math.max(...entities.map((entity) => entity.entity.length))
  return entities.map((entity) => entityLine(entity, width)).join('\n')
}

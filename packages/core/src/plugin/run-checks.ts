import type { CheckContext, CheckReport, CheckResult } from './check'
import type { FakewarePlugin } from './define'

export class PluginCheckError extends Error {
  readonly reports: CheckReport[]

  constructor(reports: CheckReport[]) {
    super(reports.map(lineFor).join('\n'))
    this.name = 'PluginCheckError'
    this.reports = reports
  }
}

function lineFor(report: CheckReport): string {
  const hint = report.hint ? ` ${report.hint}` : ''
  return `Plugin "${report.plugin}" check "${report.check}" failed: ${report.message}${hint}`
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function toReport(plugin: string, check: string, outcome: Awaited<CheckResult>): CheckReport {
  if (!outcome) return { plugin, check, level: 'ok', message: 'passed' }
  const report: CheckReport = {
    plugin,
    check,
    level: outcome.level,
    message: outcome.message,
  }
  if (outcome.hint !== undefined) report.hint = outcome.hint
  return report
}

export async function runPluginChecks(
  plugins: FakewarePlugin[],
  contextFor: (plugin: FakewarePlugin) => CheckContext,
  opts: { shop: boolean },
): Promise<CheckReport[]> {
  const reports: CheckReport[] = []
  for (const plugin of plugins) {
    for (const check of plugin.checks ?? []) {
      if (check.needsShop && !opts.shop) continue
      try {
        reports.push(toReport(plugin.name, check.name, await check.run(contextFor(plugin))))
      } catch (error) {
        reports.push({
          plugin: plugin.name,
          check: check.name,
          level: 'error',
          message: messageOf(error),
        })
      }
    }
  }
  return reports
}

export function countShopChecks(plugins: FakewarePlugin[]): number {
  return plugins.reduce(
    (total, plugin) => total + (plugin.checks ?? []).filter((check) => check.needsShop).length,
    0,
  )
}

export function reportFailures(reports: CheckReport[]): void {
  const failures = reports.filter((report) => report.level === 'error')
  if (failures.length > 0) throw new PluginCheckError(failures)
}

import * as p from '@clack/prompts'
import type { ApplyFailure, LogEntry, Reporter, ReportStep } from '@fakeware/core'
import pc from 'picocolors'

type Marker = '+' | '-' | '~' | '='

const PAINT: Record<Marker, (s: string) => string> = {
  '+': pc.green,
  '-': pc.red,
  '~': pc.yellow,
  '=': pc.dim,
}

export function counts(...parts: [Marker, number][]): string {
  const shown = parts.filter(([, n]) => n > 0)
  if (shown.length === 0) return pc.dim('—')
  return shown.map(([marker, n]) => PAINT[marker](`${marker}${n}`)).join(' ')
}

function errorBlock(failure: ApplyFailure): string {
  const { error } = failure
  const status = error.status !== null ? pc.dim(` (HTTP ${error.status})`) : ''
  const head = `${pc.red('✖')} ${pc.cyan(failure.entity)} ${error.message}${status}`
  const details = error.errors.slice(0, 10).map((e) => {
    const field = e.field ? `${pc.yellow(e.field)}: ` : ''
    const where = e.recordId ? pc.dim(` (${e.recordId})`) : ''
    return `    ${pc.dim('•')} ${field}${e.detail}${where}`
  })
  const more = error.errors.length - 10
  if (more > 0) details.push(pc.dim(`    • …and ${more} more`))
  return [head, ...details].join('\n')
}

export interface RunReporter extends Reporter {
  finish(): void
}

export function spinnerReporter(
  verb: { active: string; done: string },
  detail: (step: ReportStep) => string,
): RunReporter {
  const spinner = p.spinner()
  const done: ReportStep[] = []
  const failures: ApplyFailure[] = []
  const logs: LogEntry[] = []
  let started = false

  const ensure = (): void => {
    if (!started) {
      spinner.start(`${verb.active}…`)
      started = true
    }
  }

  return {
    entityStart(entity): void {
      ensure()
      spinner.message(`${verb.active} ${pc.cyan(entity)}`)
    },
    entityDone(step): void {
      done.push(step)
      ensure()
      spinner.message(`${verb.done} ${pc.cyan(step.entity)} ${detail(step)}`)
    },
    failed(failure): void {
      failures.push(failure)
    },
    log(entry): void {
      logs.push(entry)
    },
    finish(): void {
      const summary = done
        .map((s) => `${pc.cyan(s.entity)} ${detail(s)}`)
        .filter((line) => line.length > 0)
      if (started) {
        spinner.stop(
          done.length > 0
            ? `${verb.done} ${pc.dim(`${done.length} ${done.length === 1 ? 'entity' : 'entities'}`)}`
            : `${verb.done} ${pc.dim('nothing to do')}`,
        )
      }
      for (const entry of logs) {
        const line = `${pc.dim(`[${entry.plugin}]`)} ${entry.message}`
        if (entry.level === 'error') p.log.error(line)
        else if (entry.level === 'warn') p.log.warn(line)
        else p.log.info(line)
      }
      if (summary.length > 0) p.log.message(summary.join('\n'))
      for (const failure of failures) p.log.error(errorBlock(failure))
    },
  }
}

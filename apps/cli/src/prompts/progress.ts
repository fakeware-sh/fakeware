import * as p from '@clack/prompts'
import type { Reporter, ReportStep } from '@fakeware/core'
import pc from 'picocolors'

type Marker = '+' | '-' | '~' | '='

const PAINT: Record<Marker, (s: string) => string> = {
  '+': pc.green,
  '-': pc.red,
  '~': pc.yellow,
  '=': pc.dim,
}

export function spinnerReporter(
  verb: { active: string; done: string },
  detail: (step: ReportStep) => string,
): Reporter {
  let active: p.SpinnerResult | null = null
  let bar: p.ProgressResult | null = null
  let head = ''
  let advanced = 0
  let atomic = false
  return {
    onTransactionStart: (info) => {
      atomic = info.mode === 'atomic'
      if (atomic) {
        active = p.spinner()
        active.start(verb.active)
      }
    },
    onStart: (entity, records) => {
      if (atomic) return
      head = `${verb.active} ${pc.cyan(entity)}`
      advanced = 0
      if (records && records > 1) {
        bar = p.progress({ style: 'block', max: records, size: 20 })
        bar.start(`${head}  ${pc.dim(`0/${records}`)}`)
        active = bar
      } else {
        bar = null
        active = p.spinner()
        active.start(head)
      }
    },
    onBatch: (progress) => {
      if (!bar) return
      bar.advance(
        progress.records - advanced,
        `${head}  ${pc.dim(`${progress.records}/${progress.recordsTotal}`)}`,
      )
      advanced = progress.records
    },
    onStep: (step) => {
      if (atomic) return
      active?.stop(`${verb.done} ${pc.cyan(step.entity)}${detail(step)}`)
      active = bar = null
    },
    onCommit: (info) => {
      if (!atomic) return
      const label = info.committed === 1 ? 'change' : 'changes'
      active?.stop(`${verb.done} ${pc.green(String(info.committed))} ${label}`)
      active = null
    },
    onCompensate: (entity, count) => {
      p.log.message(`Reverted ${pc.cyan(entity)}${counts(['-', count])}`, {
        symbol: pc.yellow('↺'),
      })
    },
    onCompensateFail: (entity) => {
      p.log.warn(`Could not revert ${pc.cyan(entity)}`)
    },
    onSkip: (info) => {
      active?.error(`${verb.active} ${pc.cyan(info.entity)}`)
      active = bar = null
      p.log.warn(`Skipped ${pc.cyan(info.entity)}`)
      if (info.error instanceof Error) p.log.message(pc.dim(info.error.message))
    },
    onStop: (info) => {
      const label = info.failedEntity
        ? info.message.replace(info.failedEntity, pc.cyan(info.failedEntity))
        : info.message
      active?.error(label)
      active = bar = null
    },
  }
}

export function counts(...parts: [Marker, number][]): string {
  const shown = parts.filter(([, n]) => n > 0)
  if (shown.length === 0) return pc.dim('  —')
  const body = shown.map(([marker, n]) => PAINT[marker](`${marker}${n}`)).join(' ')
  return `  ${body}`
}

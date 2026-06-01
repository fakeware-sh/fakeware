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
  const s = p.spinner()
  let atomic = false
  return {
    onTransactionStart: (info) => {
      atomic = info.mode === 'atomic'
    },
    onStart: (entity) => {
      if (atomic) return
      s.start(`${verb.active} ${pc.cyan(entity)}`)
    },
    onStep: (step) => {
      if (atomic) return
      s.stop(`${verb.done} ${pc.cyan(step.entity)}${detail(step)}`)
    },
    onCommit: (info) => {
      if (!atomic) return
      const label = info.committed === 1 ? 'change' : 'changes'
      s.start(`Committing ${info.committed} ${label} atomically`)
      s.stop(`Committed ${pc.green(String(info.committed))} ${label} atomically`)
    },
    onCompensate: (entity, count) => {
      s.start(`${pc.red('Rolling back')} ${pc.cyan(entity)}`)
      s.stop(`${pc.red('Rolled back')} ${pc.cyan(entity)} ${pc.red(`-${count}`)}`)
    },
    onSkip: (info) => {
      s.stop(`${pc.yellow('Skipped')} ${pc.cyan(info.entity)}`)
    },
    onStop: (info) => {
      s.stop(`${pc.red('Failed at')} ${pc.cyan(info.failedEntity)}`)
    },
  }
}

export function counts(...parts: [Marker, number][]): string {
  const shown = parts.filter(([, n]) => n > 0)
  if (shown.length === 0) return pc.dim('  —')
  const body = shown.map(([marker, n]) => PAINT[marker](`${marker}${n}`)).join(' ')
  return `  ${body}`
}

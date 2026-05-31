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
  return {
    onStart: (entity) => s.start(`${verb.active} ${pc.cyan(entity)}`),
    onStep: (step) => s.stop(`${verb.done} ${pc.cyan(step.entity)}${detail(step)}`),
  }
}

export function counts(...parts: [Marker, number][]): string {
  const shown = parts.filter(([, n]) => n > 0)
  if (shown.length === 0) return pc.dim('  —')
  const body = shown.map(([marker, n]) => PAINT[marker](`${marker}${n}`)).join(' ')
  return `  ${body}`
}

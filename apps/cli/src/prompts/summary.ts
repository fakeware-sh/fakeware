import * as p from '@clack/prompts'
import pc from 'picocolors'
import { cancelable } from './cancel'

export interface SummaryRow {
  label: string
  value: string
}

export async function promptConfirmSummary(rows: SummaryRow[]): Promise<boolean> {
  const width = Math.max(...rows.map((r) => r.label.length))
  const body = rows.map((r) => `${pc.dim(r.label.padEnd(width))}  ${r.value}`).join('\n')
  p.note(body, 'Review setup')
  return cancelable(await p.confirm({ message: 'Proceed with these settings?' }))
}

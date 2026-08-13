import { relative } from 'node:path'
import pc from 'picocolors'
import terminalLink from 'terminal-link'
import type { WrittenFile } from '../../lib/scaffolding'
import type { InitFlags } from './flags'

const DOCS_URL = 'https://fakeware.sh'

function docsLink(): string {
  return terminalLink(pc.cyan('fakeware.sh'), DOCS_URL, { fallback: (text) => text })
}

function cdHint(dir: string): string | undefined {
  const rel = relative(process.cwd(), dir)
  return rel === '' ? undefined : `cd ${rel}`
}

export function outroFor(
  flags: InitFlags,
  dir: string,
  created: WrittenFile[],
  exampleData = true,
): string {
  if (flags.dryRun) {
    const count = created.length
    return `Dry run complete. ${count} ${count === 1 ? 'file' : 'files'} would be written, but nothing was created.`
  }

  const steps = [cdHint(dir), ...nextSteps(flags, exampleData)].filter((step): step is string =>
    Boolean(step),
  )
  const list = steps.map((step) => `  ${pc.cyan(step)}`).join('\n')
  return `You're all set.\n\n${list}\n\nDocs: ${docsLink()}`
}

function nextSteps(flags: InitFlags, exampleData: boolean): string[] {
  if (flags.template === 'plugin') return ['bun test', 'bun run typecheck']
  if (!exampleData) return ['# add a file in data/ to describe what to create', 'fakeware up']
  return ['fakeware up --dry-run', 'fakeware up']
}

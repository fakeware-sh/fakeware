import { basename } from 'node:path'
import * as p from '@clack/prompts'
import { Command } from 'commander'
import pc from 'picocolors'
import { EXIT_FAILURE, exit } from '../../lib/exit-codes'
import type { PackageManager } from '../../lib/package-manager'
import { SCAFFOLD_TEMPLATES, ScaffoldError, type SecretsDest } from '../../lib/scaffolding'
import { assertOneOf, resolveTargetDir, toValidPackageName } from '../../lib/utils'
import { promptConfirmSummary, type SummaryRow } from '../../prompts'
import { cleanupPartial, executeScaffold } from './execute'
import type { InitFlags } from './flags'
import { abortUnconfirmed, gatherInputs, type InitInputs, isNonInteractive } from './gather'
import { outroFor } from './outro'

const SECRETS: readonly SecretsDest[] = ['env', 'inline']
const PACKAGE_MANAGERS: readonly PackageManager[] = ['bun', 'npm', 'pnpm', 'yarn']

export function initCommand(): Command {
  return new Command('init')
    .description('Scaffold a project (package.json + typed config + .env) or a plugin')
    .option(
      '--template <kind>',
      'project | plugin',
      (value) => assertOneOf(value, SCAFFOLD_TEMPLATES),
      'project',
    )
    .option('--url <url>', 'Shopware URL')
    .option('--client-id <id>', 'OAuth2 client ID')
    .option('--client-secret <secret>', 'OAuth2 client secret')
    .option('--output <path>', 'Directory to scaffold into (default: cwd)')
    .option('--secrets <dest>', 'env | inline', (value) => assertOneOf(value, SECRETS), 'env')
    .option('--package-manager <pm>', 'bun | npm | pnpm | yarn (default: auto-detect)', (value) =>
      assertOneOf(value, PACKAGE_MANAGERS),
    )
    .option('--plugins <list>', 'Official plugin ids to add (comma-separated), or "all" | "none"')
    .option('--no-plugins', 'Do not add any official plugins')
    .option('--no-example-data', 'Do not scaffold the example data/products.ts file')
    .option('--no-install', 'Write files but skip dependency install')
    .option('--force', 'Overwrite existing files', false)
    .option('--dry-run', 'Preview the files that would be written without writing them', false)
    .option('--yes', 'Accept defaults; never prompt')
    .action(async (opts: InitFlags) => {
      await runInit(opts)
    })
}

export function buildSummaryRows(
  flags: InitFlags,
  inputs: InitInputs,
  dir: string,
  projectName: string,
): SummaryRow[] {
  const rows: SummaryRow[] = [
    { label: 'Template', value: flags.template },
    { label: 'Directory', value: dir },
    { label: flags.template === 'plugin' ? 'Package' : 'Project', value: projectName },
    { label: 'Package manager', value: inputs.packageManager },
    { label: 'Install', value: flags.dryRun ? 'dry run' : flags.install ? 'yes' : 'skip' },
  ]

  if (flags.template === 'project') {
    const connected = Boolean(inputs.url && inputs.clientId && inputs.clientSecret)
    rows.push(
      { label: 'Shop', value: connected ? (inputs.url ?? '') : 'not configured' },
      {
        label: 'Plugins',
        value: inputs.plugins.length
          ? inputs.plugins.map((plugin) => plugin.id).join(', ')
          : 'none',
      },
      { label: 'Secrets', value: flags.secrets },
      { label: 'Example data', value: inputs.exampleData ? 'data/products.ts' : 'none' },
    )
  }

  return rows
}

async function runInit(flags: InitFlags): Promise<void> {
  const inputs = await gatherInputs(flags)

  const dir = resolveTargetDir(inputs.location)
  const projectName = toValidPackageName(basename(dir))

  if (!isNonInteractive(flags)) {
    const proceed = await promptConfirmSummary(buildSummaryRows(flags, inputs, dir, projectName))
    if (!proceed) abortUnconfirmed()
  }

  const run = { dir, projectName, flags, inputs }

  try {
    const { created, installNote } = await executeScaffold(run)

    if (!flags.install) {
      p.log.info(`Skipped install. Run ${pc.cyan(`${inputs.packageManager} install`)} when ready.`)
    }
    if (installNote) p.log.warn(installNote)

    p.outro(outroFor(flags, dir, created, inputs.exampleData))
  } catch (error) {
    if (error instanceof ScaffoldError) {
      await reportScaffoldFailure(error, flags)
    }
    throw error
  }
}

async function reportScaffoldFailure(error: ScaffoldError, flags: InitFlags): Promise<never> {
  const removed = flags.dryRun ? [] : await cleanupPartial(error.written)
  p.cancel(error.message)
  if (removed.length > 0) {
    p.log.info(
      `Rolled back ${removed.length} partially written ${removed.length === 1 ? 'file' : 'files'}.`,
    )
  } else if (error.written.length > 0) {
    p.log.warn(
      `These files were written before the failure and were left in place:\n${error.written.map((f) => `  ${f.path}`).join('\n')}`,
    )
  }
  exit(EXIT_FAILURE)
}

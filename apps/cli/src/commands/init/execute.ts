import { mkdir, rm } from 'node:fs/promises'
import { basename } from 'node:path'
import * as p from '@clack/prompts'
import pc from 'picocolors'
import { type InstallResult, type PackageManager, runInstall } from '../../lib/package-manager'
import { scaffoldProject, type WrittenFile } from '../../lib/scaffolding'
import { emptyDir } from '../../lib/utils'
import type { InitFlags } from './flags'
import type { InitInputs } from './gather'

export interface ScaffoldRun {
  dir: string
  projectName: string
  flags: InitFlags
  inputs: InitInputs
}

async function writeFiles(run: ScaffoldRun): Promise<WrittenFile[]> {
  const { dir, projectName, flags, inputs } = run
  if (!flags.dryRun) {
    await mkdir(dir, { recursive: true })
    if (inputs.dirStrategy === 'remove') await emptyDir(dir)
  }
  return scaffoldProject({
    dir,
    force: flags.force || inputs.dirStrategy !== 'fresh',
    dryRun: flags.dryRun,
    values: {
      projectName,
      url: inputs.url,
      clientId: inputs.clientId,
      clientSecret: inputs.clientSecret,
      secrets: flags.secrets,
      plugins: inputs.plugins,
      template: flags.template,
      exampleData: inputs.exampleData,
    },
  })
}

async function tryRemove(path: string): Promise<boolean> {
  try {
    await rm(path, { force: true })
    return true
  } catch {
    return false
  }
}

export async function cleanupPartial(written: WrittenFile[]): Promise<string[]> {
  const removed: string[] = []
  for (const file of written) {
    if (await tryRemove(file.path)) removed.push(file.path)
  }
  return removed
}

export function installNoteFor(pm: PackageManager, dir: string, result: InstallResult): string {
  if (result.notFound) {
    return `${pc.cyan(pm)} was not found on your PATH. Files are written. Run ${pc.cyan(`${pm} install`)} in ${dir} once it's available.`
  }
  return `${result.output.trim().split('\n').slice(-5).join('\n')}\n\nFiles are written. Run ${pc.cyan(`${pm} install`)} in ${dir} to retry.`
}

export interface ExecuteResult {
  created: WrittenFile[]
  installNote?: string
}

export async function executeScaffold(run: ScaffoldRun): Promise<ExecuteResult> {
  const { dir, flags, inputs } = run
  const pm = inputs.packageManager

  const created = await runScaffoldTask(run)

  if (!(flags.install && !flags.dryRun)) return { created }

  const install = await runInstallTask(pm, dir)
  return install ? { created, installNote: install } : { created }
}

async function runScaffoldTask(run: ScaffoldRun): Promise<WrittenFile[]> {
  const { flags } = run
  const files: WrittenFile[] = []

  await p.tasks([
    {
      title: flags.dryRun ? 'Previewing project files' : 'Creating project files',
      task: async () => {
        files.push(...(await writeFiles(run)))
        const names = files.map((f) => pc.cyan(basename(f.path))).join(', ')
        return flags.dryRun ? `Would create ${names}` : `Created ${names}`
      },
    },
  ])

  return files
}

async function runInstallTask(pm: PackageManager, dir: string): Promise<string | undefined> {
  let note: string | undefined

  await p.tasks([
    {
      title: `Installing dependencies with ${pm}`,
      task: async () => {
        const result = await runInstall(pm, dir)
        if (result.ok) return `Installed dependencies with ${pm}`
        note = installNoteFor(pm, dir, result)
        return 'Install skipped, see note below'
      },
    },
  ])

  return note
}

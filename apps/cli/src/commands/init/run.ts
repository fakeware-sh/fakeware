import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { basename } from 'node:path'
import * as p from '@clack/prompts'
import pc from 'picocolors'
import { detectPackageManager, installArgs, type PackageManager } from '../../utils/package-manager'
import { resolveTargetDir, toValidPackageName } from '../../utils/path'
import { ScaffoldError, scaffoldProject } from '../../utils/scaffold'
import { type ConfigFormat, configFileName, type SecretsDest } from '../../utils/templates'
import { assertOneOf } from '../../utils/validate'
import { gatherInputs } from './prompts'

export interface InitFlags {
  url?: string
  clientId?: string
  clientSecret?: string
  scenario?: string
  locale?: string
  format: ConfigFormat
  output?: string
  secrets: SecretsDest
  packageManager?: PackageManager
  install: boolean
  force: boolean
  yes?: boolean
}

export const FORMATS: readonly ConfigFormat[] = ['ts', 'js', 'yaml', 'json']
export const SECRETS: readonly SecretsDest[] = ['env', 'inline', 'keychain']
export const PACKAGE_MANAGERS: readonly PackageManager[] = ['bun', 'npm', 'pnpm', 'yarn']

function runInstall(pm: PackageManager, dir: string): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolvePromise) => {
    const child = spawn(pm, installArgs(pm), { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] })
    let buffer = ''
    child.stdout?.on('data', (chunk) => {
      buffer += chunk
    })
    child.stderr?.on('data', (chunk) => {
      buffer += chunk
    })
    child.on('error', (error) => resolvePromise({ ok: false, output: error.message }))
    child.on('close', (code) => resolvePromise({ ok: code === 0, output: buffer }))
  })
}

export async function runInit(flags: InitFlags): Promise<void> {
  const format = assertOneOf(flags.format, FORMATS, '--format')
  const secrets = assertOneOf(flags.secrets, SECRETS, '--secrets')

  const inputs = await gatherInputs(flags)

  const dir = resolveTargetDir(inputs.location)
  const projectName = toValidPackageName(basename(dir))

  await mkdir(dir, { recursive: true })

  let created: Awaited<ReturnType<typeof scaffoldProject>>
  try {
    created = await scaffoldProject({
      dir,
      format,
      force: flags.force,
      values: {
        projectName,
        url: inputs.url,
        clientId: inputs.clientId,
        clientSecret: inputs.clientSecret,
        locale: inputs.locale,
        scenario: flags.scenario,
        secrets,
      },
    })
  } catch (error) {
    if (error instanceof ScaffoldError) {
      p.cancel(error.message)
      process.exit(1)
    }
    throw error
  }

  for (const file of created) {
    p.log.success(`Created ${pc.cyan(basename(file.path))}  ${pc.dim(`(${file.note})`)}`)
  }

  const pm = flags.packageManager ?? (await detectPackageManager(dir))

  if (flags.install) {
    const s = p.spinner()
    s.start(`Installing dependencies with ${pm}`)
    const result = await runInstall(pm, dir)
    if (result.ok) {
      s.stop(`Installed dependencies with ${pm}`)
    } else {
      s.stop('Install failed')
      const tail = result.output.trim().split('\n').slice(-5).join('\n')
      p.log.warn(
        `${tail}\n\nYour files are written — run ${pc.cyan(`${pm} install`)} once @fakeware-sh/core is available.`,
      )
    }
  } else {
    p.log.info(`Skipped install. Run ${pc.cyan(`${pm} install`)} when ready.`)
  }

  p.outro(`Next: edit ${pc.cyan(configFileName(format))}, then run ${pc.cyan('fakeware seed')}.`)
}

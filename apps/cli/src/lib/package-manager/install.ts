import { spawn } from 'node:child_process'
import { installArgs, type PackageManager } from './detect'

export interface InstallResult {
  ok: boolean
  output: string
}

export function runInstall(pm: PackageManager, dir: string): Promise<InstallResult> {
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

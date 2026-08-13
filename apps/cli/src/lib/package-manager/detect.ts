import { join } from 'node:path'
import { fileExists } from '../utils'

export type PackageManager = 'bun' | 'npm' | 'pnpm' | 'yarn'

export const PACKAGE_MANAGERS: readonly PackageManager[] = ['bun', 'npm', 'pnpm', 'yarn']

const DETECTION_ORDER: readonly { pm: PackageManager; lockfiles: string[] }[] = [
  { pm: 'bun', lockfiles: ['bun.lock', 'bun.lockb'] },
  { pm: 'pnpm', lockfiles: ['pnpm-lock.yaml'] },
  { pm: 'yarn', lockfiles: ['yarn.lock'] },
  { pm: 'npm', lockfiles: ['package-lock.json'] },
]

function isPackageManager(value: string | undefined): value is PackageManager {
  return PACKAGE_MANAGERS.includes(value as PackageManager)
}

function fromUserAgent(userAgent: string | undefined): PackageManager | undefined {
  const name = userAgent?.split('/')[0]
  return isPackageManager(name) ? name : undefined
}

export async function detectPackageManager(
  dir: string,
  userAgent: string | undefined = process.env.npm_config_user_agent,
): Promise<PackageManager> {
  for (const { pm, lockfiles } of DETECTION_ORDER) {
    for (const lockfile of lockfiles) {
      if (await fileExists(join(dir, lockfile))) return pm
    }
  }
  return fromUserAgent(userAgent) ?? 'bun'
}

export function installArgs(pm: PackageManager): string[] {
  return pm === 'yarn' ? [] : ['install']
}

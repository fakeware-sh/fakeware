import { access } from 'node:fs/promises'
import { join } from 'node:path'

export type PackageManager = 'bun' | 'npm' | 'pnpm' | 'yarn'

const LOCKFILES: Record<PackageManager, string[]> = {
  bun: ['bun.lock', 'bun.lockb'],
  pnpm: ['pnpm-lock.yaml'],
  yarn: ['yarn.lock'],
  npm: ['package-lock.json'],
}

function fromUserAgent(userAgent: string | undefined): PackageManager | undefined {
  if (!userAgent) return undefined
  const name = userAgent.split('/')[0]
  if (name === 'bun' || name === 'npm' || name === 'pnpm' || name === 'yarn') {
    return name
  }
  return undefined
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export async function detectPackageManager(
  dir: string,
  userAgent: string | undefined = process.env.npm_config_user_agent,
): Promise<PackageManager> {
  for (const pm of Object.keys(LOCKFILES) as PackageManager[]) {
    for (const lockfile of LOCKFILES[pm]) {
      if (await fileExists(join(dir, lockfile))) return pm
    }
  }
  return fromUserAgent(userAgent) ?? 'bun'
}

export function installArgs(pm: PackageManager): string[] {
  return pm === 'yarn' ? [] : ['install']
}

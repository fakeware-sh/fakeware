import { homedir } from 'node:os'
import { isAbsolute, resolve } from 'node:path'

export function expandHome(input: string): string {
  if (input === '~') return homedir()
  if (input.startsWith('~/') || input.startsWith('~\\')) {
    return resolve(homedir(), input.slice(2))
  }
  return input
}

export function resolveTargetDir(input: string, base: string = process.cwd()): string {
  const expanded = expandHome(input.trim())
  return isAbsolute(expanded) ? expanded : resolve(base, expanded)
}

export function toValidPackageName(input: string): string {
  const name = input
    .trim()
    .toLowerCase()
    .replace(/^[._]+/, '')
    .replace(/[^a-z0-9-~]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 214)
  return name || 'fakeware-project'
}

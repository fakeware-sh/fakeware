import { access, readFile, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import {
  type ConfigFormat,
  configFileName,
  configTemplate,
  envTemplate,
  packageJsonTemplate,
  type ScaffoldValues,
} from './templates'

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export interface ScaffoldOptions {
  dir: string
  format: ConfigFormat
  force: boolean
  values: ScaffoldValues
}

export interface WrittenFile {
  path: string
  note: string
}

export class ScaffoldError extends Error {}

async function writeFresh(
  path: string,
  contents: string,
  force: boolean,
  note: string,
  created: WrittenFile[],
): Promise<void> {
  if (!force && (await fileExists(path))) {
    throw new ScaffoldError(`${basename(path)} already exists. Re-run with --force to overwrite.`)
  }
  await writeFile(path, contents)
  created.push({ path, note })
}

async function ensureGitignore(dir: string, created: WrittenFile[]): Promise<void> {
  const path = join(dir, '.gitignore')
  if (!(await fileExists(path))) {
    await writeFile(path, '.env\nnode_modules/\n')
    created.push({ path, note: 'created (.env ignored)' })
    return
  }
  const current = await readFile(path, 'utf8')
  const hasEnv = current
    .split('\n')
    .some((line) => line.trim() === '.env' || line.trim() === '/.env')
  if (!hasEnv) {
    const sep = current.endsWith('\n') || current.length === 0 ? '' : '\n'
    await writeFile(path, `${current}${sep}.env\n`)
    created.push({ path, note: 'updated (.env ignored)' })
  }
}

export async function scaffoldProject(options: ScaffoldOptions): Promise<WrittenFile[]> {
  const { dir, format, force, values } = options
  const created: WrittenFile[] = []

  await writeFresh(
    join(dir, 'package.json'),
    packageJsonTemplate(values),
    force,
    'devDependency: @fakeware-sh/core',
    created,
  )

  await writeFresh(
    join(dir, configFileName(format)),
    configTemplate(values, format),
    force,
    'typed via @fakeware-sh/core/config',
    created,
  )

  if (values.secrets === 'env') {
    await writeFresh(join(dir, '.env'), envTemplate(values), force, 'credentials', created)
    await ensureGitignore(dir, created)
  }

  return created
}

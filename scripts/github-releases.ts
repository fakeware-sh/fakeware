import { spawnSync } from 'node:child_process'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dir, '..')

const PACKAGE_DIRS = [
  'packages/core',
  'apps/cli',
  'apps/create-fakeware',
  'plugins/plugin-pickware',
]

interface RunResult {
  status: number
  stdout: string
  stderr: string
}

function run(cmd: string, args: string[]): RunResult {
  const result = spawnSync(cmd, args, { cwd: root, encoding: 'utf8' })
  return { status: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
}

const dirByName = new Map<string, string>()
for (const dir of PACKAGE_DIRS) {
  const pkg = (await Bun.file(join(root, dir, 'package.json')).json()) as { name: string }
  dirByName.set(pkg.name, dir)
}

async function changelogSection(dir: string, version: string): Promise<string | null> {
  const file = Bun.file(join(root, dir, 'CHANGELOG.md'))
  if (!(await file.exists())) return null
  const lines = (await file.text()).split('\n')
  const start = lines.findIndex((line) => line.startsWith(`## ${version}`))
  if (start === -1) return null
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i]?.startsWith('## ')) {
      end = i
      break
    }
  }
  const section = lines
    .slice(start + 1, end)
    .join('\n')
    .trim()
  return section.length > 0 ? section : null
}

const tags = run('git', ['tag', '--points-at', 'HEAD']).stdout.trim().split('\n').filter(Boolean)

let failed = false

for (const tag of tags) {
  const at = tag.lastIndexOf('@')
  if (at <= 0) continue
  const name = tag.slice(0, at)
  const version = tag.slice(at + 1)
  const dir = dirByName.get(name)
  if (!dir) continue
  if (run('gh', ['release', 'view', tag]).status === 0) {
    console.log(`skip ${tag} (release exists)`)
    continue
  }
  const notes = (await changelogSection(dir, version)) ?? `Release ${tag}`
  const create = run('gh', ['release', 'create', tag, '--title', tag, '--notes', notes])
  if (create.status !== 0) {
    console.error(`release failed for ${tag}\n${create.stdout}${create.stderr}`)
    failed = true
    continue
  }
  console.log(`released ${tag}`)
}

if (failed) process.exit(1)

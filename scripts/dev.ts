import { dirname, relative, resolve } from 'node:path'
import { Glob } from 'bun'

const root = resolve(import.meta.dir, '..')

type Group = 'packages' | 'apps' | 'plugins'

interface Target {
  name: string
  label: string
  group: Group
  cwd: string
  cmd: string[]
}

const GROUP_ORDER: Group[] = ['packages', 'apps', 'plugins']

const GROUP_META: Record<Group, { title: string; color: number }> = {
  packages: { title: 'packages', color: 36 },
  apps: { title: 'apps', color: 33 },
  plugins: { title: 'plugins', color: 35 },
}

function shortLabel(name: string): string {
  return name.replace(/^@[^/]+\//, '')
}

async function discoverTargets(): Promise<Target[]> {
  const found: Target[] = []
  const groups: [Group, string][] = [
    ['packages', 'packages/*/package.json'],
    ['apps', 'apps/*/package.json'],
    ['plugins', 'plugins/*/package.json'],
  ]
  for (const [group, pattern] of groups) {
    const glob = new Glob(pattern)
    for await (const match of glob.scan({ cwd: root, dot: false })) {
      const path = resolve(root, match)
      const cwd = dirname(path)
      const pkg = (await Bun.file(path).json()) as {
        name?: string
        scripts?: Record<string, string>
      }
      if (!pkg.scripts?.dev) continue
      const name = pkg.name ?? relative(root, cwd)
      found.push({ name, label: shortLabel(name), group, cwd, cmd: ['bun', 'run', 'dev'] })
    }
  }
  return found
}

function parseFlags(argv: string[]): { verbose: boolean; filters: string[] } {
  let verbose = false
  const filters: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--verbose' || arg === '-v') verbose = true
    else if (arg === '--only' || arg === '--filter') {
      const value = argv[++i]
      if (value) filters.push(...value.split(','))
    } else if (arg?.startsWith('--only=') || arg?.startsWith('--filter=')) {
      filters.push(...arg.slice(arg.indexOf('=') + 1).split(','))
    }
  }
  return { verbose, filters: filters.map((f) => f.trim().toLowerCase()).filter(Boolean) }
}

const c = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  color: (n: number, s: string) => `\x1b[${n}m${s}\x1b[0m`,
}

const ESC = String.fromCharCode(27)
const STRIP_ANSI = new RegExp(`${ESC}\\[[0-9;]*m`, 'g')
const stripAnsi = (s: string): string => s.replace(STRIP_ANSI, '')

const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

type Phase = 'starting' | 'building' | 'ready' | 'error'

interface Runner {
  target: Target
  proc: Bun.Subprocess
  phase: Phase
  lastMs: number | null
  log: string[]
  drained: Promise<void>
}

function classify(line: string): { phase?: Phase; ms?: number } {
  const text = stripAnsi(line)
  if (/Build start/i.test(text)) return { phase: 'building' }
  const done = text.match(/(?:Rebuilt|Build complete) in ([\d.]+)\s*m?s/i)
  if (done) return { phase: 'ready', ms: Math.round(Number(done[1])) }
  if (/\b(error|failed|✗|✘|ERR_|Cannot find|is not assignable|Transform failed)\b/i.test(text)) {
    return { phase: 'error' }
  }
  return {}
}

async function main(): Promise<void> {
  const { verbose, filters } = parseFlags(process.argv.slice(2))
  const all = await discoverTargets()
  const targets = filters.length
    ? all.filter((t) => filters.some((f) => t.label.toLowerCase().includes(f) || t.group === f))
    : all

  if (targets.length === 0) {
    console.error(c.red(`dev: no targets match ${filters.join(', ')}`))
    console.error(c.dim(`dev: available: ${all.map((t) => t.label).join(', ')}`))
    process.exit(1)
  }

  const interactive = process.stdout.isTTY === true && !verbose

  let renderTimer: ReturnType<typeof setInterval> | null = null
  let frame = 0
  let drawnLines = 0
  const reportedErrors = new Set<string>()

  const runners: Runner[] = []

  function killAll(): void {
    for (const { proc } of runners) {
      try {
        if (typeof proc.pid === 'number') process.kill(-proc.pid, 'SIGTERM')
      } catch {
        proc.kill()
      }
    }
  }

  for (const target of targets) {
    let proc: Bun.Subprocess
    try {
      proc = Bun.spawn(target.cmd, {
        cwd: target.cwd,
        env: { ...process.env, FORCE_COLOR: '1' },
        stdout: 'pipe',
        stderr: 'pipe',
        detached: true,
      })
    } catch (error) {
      console.error(c.red(`dev: failed to start ${target.label}: ${(error as Error).message}`))
      killAll()
      process.exit(1)
    }
    runners.push({
      target,
      proc,
      phase: 'starting',
      lastMs: null,
      log: [],
      drained: Promise.resolve(),
    })
  }

  let shuttingDown = false

  if (interactive) runInteractive(runners)
  else runStreaming(runners)

  async function shutdown(code: number): Promise<never> {
    if (shuttingDown) await new Promise(() => {})
    shuttingDown = true
    if (interactive) stopRender()
    killAll()
    await Promise.race([
      Promise.all(runners.map((r) => r.drained)),
      new Promise((r) => setTimeout(r, 2000)),
    ])
    process.exit(code)
  }

  process.on('SIGINT', () => void shutdown(130))
  process.on('SIGTERM', () => void shutdown(143))

  const first = await Promise.race(
    runners.map(async (r) => ({ label: r.target.label, code: await r.proc.exited })),
  )
  if (!shuttingDown) {
    if (interactive) stopRender()
    const how =
      first.code === 0
        ? c.dim(`${first.label} stopped`)
        : c.red(`${first.label} crashed (exit ${first.code})`)
    console.error(`\ndev: ${how}`)
    await shutdown(first.code === 0 ? 0 : first.code)
  } else {
    await new Promise(() => {})
  }

  function ingest(runner: Runner, line: string): void {
    if (shuttingDown) {
      runner.log.push(line)
      return
    }
    const { phase, ms } = classify(line)
    if (phase === 'building') {
      runner.phase = 'building'
      runner.log = []
    } else if (phase === 'ready') {
      runner.phase = 'ready'
      if (ms !== undefined) runner.lastMs = ms
    } else if (phase === 'error') {
      runner.phase = 'error'
    }
    runner.log.push(line)
    if (runner.log.length > 400) runner.log.shift()
  }

  function runStreaming(list: Runner[]): void {
    for (const runner of list) {
      const meta = GROUP_META[runner.target.group]
      const tag = c.color(meta.color, `[${runner.target.label}]`)
      const onLine = (line: string, out: NodeJS.WriteStream) => {
        ingest(runner, line)
        out.write(`${tag} ${line}\n`)
      }
      runner.drained = Promise.all([
        pipe(runner.proc.stdout as ReadableStream<Uint8Array>, (l) => onLine(l, process.stdout)),
        pipe(runner.proc.stderr as ReadableStream<Uint8Array>, (l) => onLine(l, process.stderr)),
      ]).then(() => undefined)
    }
    const word = list.length === 1 ? 'target' : 'targets'
    console.log(
      c.dim(
        `dev: streaming ${list.length} ${word} — ${list.map((r) => r.target.label).join(', ')}`,
      ),
    )
  }

  function runInteractive(list: Runner[]): void {
    list.forEach((runner) => {
      const onLine = (line: string) => ingest(runner, line)
      runner.drained = Promise.all([
        pipe(runner.proc.stdout as ReadableStream<Uint8Array>, onLine),
        pipe(runner.proc.stderr as ReadableStream<Uint8Array>, onLine),
      ]).then(() => undefined)
    })
    process.stdout.write('\x1b[?25l')
    render()
    renderTimer = setInterval(() => {
      frame++
      render()
    }, 80)
  }

  function stopRender(): void {
    if (renderTimer) clearInterval(renderTimer)
    renderTimer = null
    render()
    process.stdout.write('\x1b[?25h')
  }

  function statusOf(runner: Runner): string {
    const ms = runner.lastMs !== null ? c.dim(` ${(runner.lastMs / 1000).toFixed(1)}s`) : ''
    switch (runner.phase) {
      case 'ready':
        return `${c.green('✓')} ${c.dim('ready')}${ms}`
      case 'error':
        return `${c.red('✗')} ${c.red('error')}`
      case 'building':
        return `${c.yellow(SPINNER[frame % SPINNER.length])} ${c.dim('building…')}`
      default:
        return `${c.dim(SPINNER[frame % SPINNER.length])} ${c.dim('starting…')}`
    }
  }

  function render(): void {
    for (const runner of runners) {
      if (runner.phase === 'error' && !reportedErrors.has(runner.target.name)) {
        reportedErrors.add(runner.target.name)
        if (drawnLines > 0) {
          process.stdout.write(`\x1b[${drawnLines}A\x1b[J`)
          drawnLines = 0
        }
        const meta = GROUP_META[runner.target.group]
        const head = c.color(meta.color, `[${runner.target.label}]`)
        console.error(`\n${c.red('✗')} ${c.bold(runner.target.name)} failed:`)
        for (const line of runner.log.slice(-40)) console.error(`${head} ${line}`)
        console.error('')
      } else if (runner.phase !== 'error') {
        reportedErrors.delete(runner.target.name)
      }
    }

    const width = Math.max(...runners.map((r) => r.target.label.length))
    const lines: string[] = []
    for (const group of GROUP_ORDER) {
      const inGroup = runners.filter((r) => r.target.group === group)
      if (inGroup.length === 0) continue
      const meta = GROUP_META[group]
      lines.push(c.color(meta.color, c.bold(meta.title)))
      for (const runner of inGroup) {
        const label = runner.target.label.padEnd(width)
        lines.push(`  ${label}  ${statusOf(runner)}`)
      }
    }
    const errors = runners.filter((r) => r.phase === 'error').length
    const ready = runners.filter((r) => r.phase === 'ready').length
    const summary = errors
      ? c.red(`${errors} error${errors > 1 ? 's' : ''}`)
      : ready === runners.length
        ? c.green('all ready')
        : c.dim('watching…')
    lines.push('')
    lines.push(c.dim(`ctrl-c to stop · ${ready}/${runners.length} ready · ${summary}`))

    if (drawnLines > 0) process.stdout.write(`\x1b[${drawnLines}A\x1b[J`)
    process.stdout.write(lines.map((l) => `${l}\n`).join(''))
    drawnLines = lines.length
  }
}

async function pipe(
  stream: ReadableStream<Uint8Array>,
  onLine: (line: string) => void,
): Promise<void> {
  const decoder = new TextDecoder()
  let buffer = ''
  for await (const chunk of stream) {
    buffer += decoder.decode(chunk, { stream: true })
    const parts = buffer.split('\n')
    buffer = parts.pop() ?? ''
    for (const line of parts) onLine(line)
  }
  if (buffer) onLine(buffer)
}

await main()

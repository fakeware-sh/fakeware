import { tryOnScopeDispose } from '@vueuse/core'
import { readonly, ref } from 'vue'

export type TerminalColor =
  | 'default'
  | 'dim'
  | 'green'
  | 'red'
  | 'yellow'
  | 'magenta'
  | 'cyan'
  | 'link'
  | 'highlight'

export type BannerColor = 'cyan' | 'yellow' | 'green' | 'red'

export interface TerminalSegment {
  text: string
  color: TerminalColor
}

export interface TerminalLine {
  glyph: string
  glyphColor: TerminalColor
  segments: TerminalSegment[]
  banner?: BannerColor
  isPrompt?: boolean
  cursor?: boolean
}

export interface TerminalSpinner {
  active: string
  done: string
  doneCount: string
  entities?: string[]
}

export interface TerminalRawRow {
  glyph?: string
  glyphColor?: TerminalColor
  segments: TerminalSegment[]
}

export interface TerminalConfirm {
  question: TerminalSegment[]
  confirmLabel: string
  cancelLabel: string
  answer: 'confirm' | 'cancel'
}

export interface TerminalStep {
  command: string
  prompt: string
  banner: BannerColor
  intro: string
  confirm: TerminalConfirm | null
  spinner: TerminalSpinner | null
  rows: TerminalRawRow[]
  outro: TerminalSegment[] | null
}

export interface TerminalTyperOptions {
  typingSpeed: number
  linePause: number
  spinnerDuration: number
  commandPause: number
  loop: boolean
}

const SPINNER_FRAMES = ['◒', '◐', '◓', '◑']
const SPINNER_INTERVAL = 80
const BAR = '│'
const BAR_START = '┌'
const BAR_END = '└'
const STEP_SUBMIT = '◇'
const STEP_ACTIVE = '◆'
const RADIO_ACTIVE = '●'
const RADIO_INACTIVE = '○'

function selectorSegments(
  confirm: TerminalConfirm,
  selected: 'confirm' | 'cancel',
): TerminalSegment[] {
  const yes = selected === 'confirm'
  return [
    { text: yes ? RADIO_ACTIVE : RADIO_INACTIVE, color: yes ? 'green' : 'dim' },
    { text: ` ${confirm.confirmLabel}`, color: yes ? 'default' : 'dim' },
    { text: ' / ', color: 'dim' },
    { text: yes ? RADIO_INACTIVE : RADIO_ACTIVE, color: yes ? 'dim' : 'green' },
    { text: ` ${confirm.cancelLabel}`, color: yes ? 'dim' : 'default' },
  ]
}

function seg(text: string, color: TerminalColor = 'default'): TerminalSegment {
  return { text, color }
}

function barSpacer(): TerminalLine {
  return { glyph: BAR, glyphColor: 'dim', segments: [] }
}

function barRow(row: TerminalRawRow): TerminalLine {
  return {
    glyph: row.glyph ?? `${BAR}  `,
    glyphColor: row.glyphColor ?? 'dim',
    segments: row.segments,
  }
}

export function useTerminalTyper(steps: TerminalStep[], options: TerminalTyperOptions) {
  const activeIndex = ref(0)
  const visibleLines = ref<TerminalLine[]>([])
  const done = ref(false)

  let cancelled = false
  let timer: ReturnType<typeof setTimeout> | null = null

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, ms)
    })

  const push = (line: TerminalLine) => {
    visibleLines.value = [...visibleLines.value, line]
  }

  const replaceLast = (line: TerminalLine) => {
    visibleLines.value = [...visibleLines.value.slice(0, -1), line]
  }

  const clearScreen = () => {
    visibleLines.value = []
  }

  const readyPrompt = (step: TerminalStep): TerminalLine => ({
    glyph: `${step.prompt} `,
    glyphColor: 'green',
    segments: [],
    isPrompt: true,
    cursor: true,
  })

  async function typeCommand(step: TerminalStep): Promise<void> {
    const promptLine = (text: string, cursor: boolean): TerminalLine => ({
      glyph: `${step.prompt} `,
      glyphColor: 'green',
      segments: [seg(text, 'highlight')],
      isPrompt: true,
      cursor,
    })
    const last = visibleLines.value[visibleLines.value.length - 1]
    const reuse = last?.isPrompt === true && last.segments.length === 0
    if (reuse) replaceLast(promptLine('', true))
    else push(promptLine('', true))
    await sleep(options.linePause)
    let text = ''
    for (const char of step.command) {
      if (cancelled) return
      text += char
      replaceLast(promptLine(text, true))
      await sleep(options.typingSpeed)
    }
    replaceLast(promptLine(text, false))
  }

  const entityDwell = (spinner: TerminalSpinner, index: number): number => {
    const base = options.spinnerDuration
    const name = spinner.entities?.[index] ?? ''
    const weight = 0.7 + ((name.length * 7 + index * 13) % 11) / 10
    return base * weight
  }

  async function runSpinner(spinner: TerminalSpinner): Promise<void> {
    const entities = spinner.entities ?? []
    const label = spinner.active.replace(/[.…]+$/, '')
    const frameLine = (glyph: string, entity: string | null, dots: string): TerminalLine => ({
      glyph: `${glyph}  `,
      glyphColor: 'magenta',
      segments: entity
        ? [seg(label, 'default'), seg(` ${entity}`, 'cyan'), seg(dots, 'default')]
        : [seg(label, 'default'), seg(dots, 'default')],
    })

    let frame = 0
    let dotProgress = 0
    const render = (entity: string | null): void => {
      replaceLast(
        frameLine(
          SPINNER_FRAMES[frame % SPINNER_FRAMES.length],
          entity,
          '.'.repeat(Math.floor(dotProgress)).slice(0, 3),
        ),
      )
    }
    const tick = async (entity: string | null): Promise<void> => {
      render(entity)
      frame += 1
      dotProgress = dotProgress < 4 ? dotProgress + 0.125 : 0
      await sleep(SPINNER_INTERVAL)
    }

    push(frameLine(SPINNER_FRAMES[0], entities[0] ?? null, ''))
    const dwells = entities.length > 0 ? entities : [null]
    for (let e = 0; e < dwells.length; e++) {
      if (cancelled) return
      const dwell = Math.max(SPINNER_INTERVAL, Math.round(entityDwell(spinner, e)))
      const frames = Math.max(1, Math.round(dwell / SPINNER_INTERVAL))
      for (let f = 0; f < frames; f++) {
        if (cancelled) return
        await tick(dwells[e] ?? null)
      }
    }
    if (cancelled) return
    replaceLast({
      glyph: `${STEP_SUBMIT}  `,
      glyphColor: 'green',
      segments: [seg(spinner.done, 'default'), seg(` ${spinner.doneCount}`, 'dim')],
    })
  }

  async function playStep(step: TerminalStep): Promise<void> {
    activeIndex.value = steps.indexOf(step)

    await typeCommand(step)
    if (cancelled) return
    await sleep(options.linePause)

    if (step.command === 'clear') {
      clearScreen()
      return
    }

    push({
      glyph: `${BAR_START}  `,
      glyphColor: 'dim',
      segments: [seg(` ${step.intro} `, 'default')],
      banner: step.banner,
    })
    push(barSpacer())

    if (step.confirm) {
      const confirm = step.confirm
      push({ glyph: `${STEP_ACTIVE}  `, glyphColor: 'green', segments: confirm.question })
      push({ glyph: `${BAR}  `, glyphColor: 'dim', segments: selectorSegments(confirm, 'cancel') })
      await sleep(options.commandPause)
      if (cancelled) return
      replaceLast({
        glyph: `${BAR}  `,
        glyphColor: 'dim',
        segments: selectorSegments(confirm, 'confirm'),
      })
      await sleep(options.commandPause * 0.6)
      if (cancelled) return
      const answerLabel = confirm.answer === 'confirm' ? confirm.confirmLabel : confirm.cancelLabel
      visibleLines.value = [
        ...visibleLines.value.slice(0, -2),
        { glyph: `${STEP_SUBMIT}  `, glyphColor: 'green', segments: confirm.question },
        { glyph: `${BAR}  `, glyphColor: 'dim', segments: [seg(answerLabel, 'dim')] },
      ]
      await sleep(options.linePause)
      push(barSpacer())
    }

    if (step.spinner) {
      await runSpinner(step.spinner)
      if (cancelled) return
      push(barSpacer())
    }

    for (const row of step.rows) {
      if (cancelled) return
      push(barRow(row))
    }

    if (step.outro) {
      push(barSpacer())
      push({ glyph: `${BAR_END}  `, glyphColor: 'dim', segments: step.outro })
    }

    push(readyPrompt(step))
    await sleep(options.commandPause)
  }

  async function run(): Promise<void> {
    clearScreen()
    for (const step of steps) {
      if (cancelled) return
      await playStep(step)
    }
    if (cancelled) return
    if (options.loop) {
      await run()
      return
    }
    done.value = true
  }

  function buildFrame(step: TerminalStep): TerminalLine[] {
    const frame: TerminalLine[] = [
      {
        glyph: `${step.prompt} `,
        glyphColor: 'green',
        segments: [seg(step.command, 'highlight')],
        isPrompt: true,
      },
      {
        glyph: `${BAR_START}  `,
        glyphColor: 'dim',
        segments: [seg(` ${step.intro} `, 'default')],
        banner: step.banner,
      },
      barSpacer(),
    ]
    if (step.confirm) {
      const answerLabel =
        step.confirm.answer === 'confirm' ? step.confirm.confirmLabel : step.confirm.cancelLabel
      frame.push({
        glyph: `${STEP_SUBMIT}  `,
        glyphColor: 'green',
        segments: step.confirm.question,
      })
      frame.push({ glyph: `${BAR}  `, glyphColor: 'dim', segments: [seg(answerLabel, 'dim')] })
      frame.push(barSpacer())
    }
    if (step.spinner) {
      frame.push({
        glyph: `${STEP_SUBMIT} `,
        glyphColor: 'green',
        segments: [seg(step.spinner.done, 'default'), seg(` ${step.spinner.doneCount}`, 'dim')],
      })
      frame.push(barSpacer())
    }
    for (const row of step.rows) frame.push(barRow(row))
    if (step.outro) {
      frame.push(barSpacer())
      frame.push({ glyph: `${BAR_END}  `, glyphColor: 'dim', segments: step.outro })
    }
    frame.push(readyPrompt(step))
    return frame
  }

  function showFinalFrame(): void {
    const step = [...steps].reverse().find((s) => s.command !== 'clear') ?? steps[steps.length - 1]
    if (!step) return
    activeIndex.value = steps.indexOf(step)
    visibleLines.value = buildFrame(step)
    done.value = true
  }

  function start(): void {
    cancelled = false
    done.value = false
    run()
  }

  function stop(): void {
    cancelled = true
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  tryOnScopeDispose(stop)

  return {
    activeIndex: readonly(activeIndex),
    visibleLines: readonly(visibleLines),
    done: readonly(done),
    start,
    stop,
    showFinalFrame,
  }
}

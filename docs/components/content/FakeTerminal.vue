<script setup lang="ts">
import { useElementVisibility, usePreferredReducedMotion } from '@vueuse/core'
import { computed, onMounted, ref, watch } from 'vue'
import {
  type BannerColor,
  type TerminalColor,
  type TerminalConfirm,
  type TerminalRawRow,
  type TerminalSpinner,
  type TerminalStep,
  useTerminalTyper,
} from '../../composables/useTerminalTyper'

interface RawSession {
  command?: string
  prompt?: string
  banner?: BannerColor
  intro?: string
  confirm?: TerminalConfirm
  spinner?: TerminalSpinner
  rows?: TerminalRawRow[]
  outro?: { text: string; color?: TerminalColor }[]
}

const props = withDefaults(
  defineProps<{
    sessions?: RawSession[]
    label?: string
    icon?: string
    typingSpeed?: number
    linePause?: number
    spinnerDuration?: number
    commandPause?: number
    loop?: boolean
    autoplay?: boolean
  }>(),
  {
    sessions: () => [],
    typingSpeed: 55,
    linePause: 260,
    spinnerDuration: 700,
    commandPause: 1600,
    loop: true,
    autoplay: true,
  },
)

const TEXT_CLASS: Record<TerminalColor, string> = {
  default: 'text-default',
  dim: 'text-dimmed',
  green: 'text-success',
  red: 'text-error',
  yellow: 'text-warning',
  magenta: 'text-primary',
  cyan: 'text-info',
  link: 'text-info underline',
  highlight: 'text-highlighted',
}

const BANNER_CLASS: Record<BannerColor, string> = {
  cyan: 'bg-info text-inverted',
  yellow: 'bg-warning text-inverted',
  green: 'bg-success text-inverted',
  red: 'bg-error text-inverted',
}

const steps = computed<TerminalStep[]>(() =>
  props.sessions.map((session) => ({
    command: session.command ?? '',
    prompt: session.prompt ?? '$',
    banner: session.banner ?? 'cyan',
    intro: session.intro ?? session.command ?? '',
    confirm: session.confirm ?? null,
    spinner: session.spinner ?? null,
    rows: session.rows ?? [],
    outro: session.outro ?? null,
  })),
)

function stepHeight(step: TerminalStep): number {
  if (step.command === 'clear') return 0
  let total = 2
  total += 1
  if (step.confirm) total += 3
  if (step.spinner) total += 2
  total += step.rows.length
  if (step.outro) total += 2
  total += 1
  return total
}

const maxLines = computed(() =>
  steps.value.reduce((max, step) => Math.max(max, stepHeight(step)), 1),
)

const LINE_HEIGHT_REM = 1.125

const bodyStyle = computed(() => ({
  height: `calc(${maxLines.value + 1} * ${LINE_HEIGHT_REM}rem)`,
}))

const root = ref<HTMLElement | null>(null)
const isVisible = useElementVisibility(root)
const reducedMotion = usePreferredReducedMotion()

const typer = useTerminalTyper(steps.value, {
  typingSpeed: props.typingSpeed,
  linePause: props.linePause,
  spinnerDuration: props.spinnerDuration,
  commandPause: props.commandPause,
  loop: props.loop,
})

const ariaLabel = computed(() => {
  const commands = steps.value.map((step) => step.command).filter((command) => command !== 'clear')
  return `Terminal demo running ${commands.join(' then ')}`
})

onMounted(() => {
  if (reducedMotion.value === 'reduce' || !props.autoplay) {
    typer.showFinalFrame()
    return
  }
  watch(
    isVisible,
    (visible) => {
      if (visible) typer.start()
      else typer.stop()
    },
    { immediate: true },
  )
})
</script>

<template>
  <div
    ref="root"
    role="img"
    :aria-label="ariaLabel"
    class="not-prose font-mono text-sm border border-muted bg-muted rounded-md rounded-t-none px-4 py-3 overflow-x-auto"
  >
    <div aria-hidden="true" :style="bodyStyle" class="leading-[1.125rem]"><div
      v-for="(line, index) in typer.visibleLines.value"
      :key="index"
      class="h-[1.125rem] whitespace-pre leading-[1.125rem]"
    ><span :class="TEXT_CLASS[line.glyphColor]">{{ line.glyph }}</span><span
      v-if="line.banner"
      class="rounded-xs px-1"
      :class="BANNER_CLASS[line.banner]"
    ><span
      v-for="(s, si) in line.segments"
      :key="si"
    >{{ s.text }}</span></span><template v-else><span
      v-for="(s, si) in line.segments"
      :key="si"
      :class="TEXT_CLASS[s.color]"
    >{{ s.text }}</span></template><span
      v-if="line.cursor"
      class="terminal-cursor text-default"
    >▋</span></div></div>
  </div>
</template>

<style scoped>
.terminal-cursor {
  animation: terminal-blink 1s steps(1) infinite;
}

@media (prefers-reduced-motion: reduce) {
  .terminal-cursor {
    animation: none;
  }
}

@keyframes terminal-blink {
  50% {
    opacity: 0;
  }
}
</style>

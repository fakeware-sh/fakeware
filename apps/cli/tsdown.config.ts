import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: false,
  minify: true,
  sourcemap: true,
  clean: true,
  target: 'node20',
  publint: true,
  onSuccess: 'bun install',
})

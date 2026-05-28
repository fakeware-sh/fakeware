import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: { 'config/index': 'src/config/index.ts' },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'node20',
  publint: true,
})

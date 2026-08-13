import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/init.ts'],
  format: ['esm'],
  loader: { '.eta': 'text', '.md': 'text' },
  dts: { entry: 'src/init.ts' },
  minify: true,
  sourcemap: true,
  clean: true,
  target: 'node22',
  publint: true,
  onSuccess: 'bun install',
})

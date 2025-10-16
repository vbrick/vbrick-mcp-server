import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/tools/*.ts'],
  format: 'esm',
  platform: 'node',
  target: 'node22',
  clean: true,
  sourcemap: true,
  shims: false,
  hash: false,
  copy: [{ from: 'src/templates', to: 'dist/templates' }],
  noExternal: [/./]
});
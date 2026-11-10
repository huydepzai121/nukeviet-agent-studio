import { build } from 'esbuild'

await build({
  entryPoints: ['agents/mock-acp-agent.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'agents/dist/mock-acp-agent.mjs',
  banner: {
    js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
  },
})

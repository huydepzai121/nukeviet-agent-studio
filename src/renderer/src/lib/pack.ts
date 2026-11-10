const loaders = import.meta.glob(
  [
    '../../../../knowledge/**/*.md',
    '../../../../knowledge/**/*.php',
    '../../../../knowledge/**/*.json',
    '../../../../templates/**/*.php',
    '../../../../templates/**/*.tpl',
    '../../../../templates/**/*.json',
    '../../../../templates/**/*.ini',
  ],
  { query: '?raw', import: 'default' },
) as Record<string, () => Promise<string>>

function normalize(key: string): string {
  const knowledge = key.indexOf('/knowledge/')
  if (knowledge >= 0) return key.slice(knowledge + 1)
  const templates = key.indexOf('/templates/')
  if (templates >= 0) return key.slice(templates + 1)
  return key.replace(/^\.\//, '')
}

const byPath = new Map<string, () => Promise<string>>()
for (const [key, loader] of Object.entries(loaders)) byPath.set(normalize(key), loader)

export function packPaths(): string[] {
  return [...byPath.keys()].sort()
}

export async function readPack(relative: string): Promise<string | null> {
  const exact = byPath.get(relative)
  if (exact) return exact()
  const hit = [...byPath.keys()].find((key) => key.endsWith(relative))
  if (!hit) return null
  return byPath.get(hit)!()
}

import type { Thread } from './types'

export function titleFromMessage(text: string): string {
  const first = text
    .replace(/```[\s\S]*?```/g, ' ')
    .split('\n')
    .map((line) => line.replace(/[`*_#>\[\]()]/g, ' ').replace(/\s+/g, ' ').trim())
    .find(Boolean)
  const clean = first ?? ''
  if (!clean) return 'New chat'
  if (clean.length <= 42) return clean
  return `${clean.slice(0, 42).trimEnd()}…`
}

export function branchSlug(title: string, id: string): string {
  const slug = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 28)
  const tail = id.replace(/[^a-z0-9]/gi, '').slice(-4).toLowerCase() || 'work'
  return `nvas/${slug || 'chat'}-${tail}`
}

export function makeThread(projectId: string, agentId: string, id: string, now = Date.now()): Thread {
  return {
    id,
    projectId,
    title: 'New chat',
    autoTitle: true,
    agentId,
    createdAt: now,
    updatedAt: now,
    messages: [],
  }
}

export function workspacePath(projectPath: string, thread: Pick<Thread, 'worktreePath'> | null | undefined): string {
  return thread?.worktreePath || projectPath
}

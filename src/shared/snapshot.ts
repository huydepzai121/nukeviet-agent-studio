import { mergeAgents, DEFAULT_SETTINGS } from './defaults'
import type { Project, RunRecord, Settings, Thread, ThreadMode } from './types'

export interface AdeSnapshot {
  version: 2
  projects: Project[]
  threads: Thread[]
  activeProjectId: string | null
  activeThreadId: string | null
  settings: Settings
  runs: RunRecord[]
  mode: ThreadMode
  filesOpen: boolean
  agentId: string
}

export function emptySnapshot(): AdeSnapshot {
  return {
    version: 2,
    projects: [],
    threads: [],
    activeProjectId: null,
    activeThreadId: null,
    settings: structuredClone(DEFAULT_SETTINGS),
    runs: [],
    mode: 'chat',
    filesOpen: true,
    agentId: 'mock',
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

export function normalizeSnapshot(raw: unknown): AdeSnapshot {
  const base = emptySnapshot()
  if (!isRecord(raw)) return base
  const settingsRaw = isRecord(raw.settings) ? raw.settings : {}
  const settings: Settings = {
    ...structuredClone(DEFAULT_SETTINGS),
    gateway: settingsRaw.gateway === 'openai' || settingsRaw.gateway === 'anthropic' || settingsRaw.gateway === 'both' ? settingsRaw.gateway : base.settings.gateway,
    baseUrl: typeof settingsRaw.baseUrl === 'string' ? settingsRaw.baseUrl : base.settings.baseUrl,
    model: typeof settingsRaw.model === 'string' ? settingsRaw.model : base.settings.model,
    models: Array.isArray(settingsRaw.models) ? settingsRaw.models.filter((item): item is string => typeof item === 'string') : base.settings.models,
    lang: settingsRaw.lang === 'en' ? 'en' : 'vi',
    agents: mergeAgents(Array.isArray(settingsRaw.agents) ? (settingsRaw.agents as Settings['agents']) : undefined),
  }
  const projects = Array.isArray(raw.projects) ? (raw.projects as Project[]) : []
  const threads = Array.isArray(raw.threads) ? (raw.threads as Thread[]) : []
  const runs = Array.isArray(raw.runs) ? (raw.runs as RunRecord[]).slice(0, 20) : []
  const mode: ThreadMode = raw.mode === 'workflow' || raw.mode === 'diff' || raw.mode === 'terminal' || raw.mode === 'chat' ? raw.mode : 'chat'
  return {
    version: 2,
    projects,
    threads: threads.map((thread) => ({ ...thread, messages: (thread.messages ?? []).slice(-120) })),
    activeProjectId: typeof raw.activeProjectId === 'string' ? raw.activeProjectId : null,
    activeThreadId: typeof raw.activeThreadId === 'string' ? raw.activeThreadId : null,
    settings,
    runs: runs.map((run) => (run.status === 'running' ? { ...run, status: 'aborted', live: false, attention: true, finishedAt: run.finishedAt ?? Date.now() } : run)),
    mode,
    filesOpen: raw.filesOpen !== false,
    agentId: typeof raw.agentId === 'string' ? raw.agentId : 'mock',
  }
}

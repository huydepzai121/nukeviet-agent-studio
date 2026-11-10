import { create } from 'zustand'
import { DEFAULT_SETTINGS, SEED_PROJECTS } from '@shared/defaults'
import { EVAL_IDS } from '@shared/workflow'
import type { ChatMessage, Lang, NodeRuntime, Project, RunRecord, Settings } from '@shared/types'
import { vi } from './i18n/dict'

const STORAGE_KEY = 'nvas.v1'

export type RunFilter = 'active' | 'attention' | 'live' | 'finished' | 'all'
export type SettingsSection = 'model' | 'agents' | 'project' | 'language'
export type CenterView = 'graph' | 'review' | 'messages'
export type InspectorTab = 'spec' | 'output' | 'transcript' | 'logs'

interface Persisted {
  projects: Project[]
  activeProjectId: string
  settings: Settings
  messages: ChatMessage[]
  runs: RunRecord[]
  agentId: string
  leftWidth: number
  rightWidth: number
  bottomHeight: number
}

interface StudioState extends Persisted {
  openRunId: string | null
  activeTab: 'workflow' | string
  centerView: CenterView
  rightTab: 'inspector' | 'workflow'
  inspectorTab: InspectorTab
  selectedNodeId: string | null
  followRun: boolean
  runsTab: 'runs' | 'evals'
  runFilter: RunFilter
  runQuery: string
  settingsOpen: boolean
  settingsSection: SettingsSection
  busy: boolean
  secretSaved: boolean
  secretStorage: 'safeStorage' | 'aes' | 'memory' | null
  toast: string | null
  set: (patch: Partial<StudioState>) => void
  patchSettings: (patch: Partial<Settings>) => void
  patchProject: (id: string, patch: Partial<Project>) => void
  addProject: (project: Project) => void
  addMessage: (message: ChatMessage) => void
  patchMessage: (id: string, patch: Partial<ChatMessage>) => void
  clearMessages: () => void
  upsertRun: (run: RunRecord) => void
  patchRun: (id: string, patch: Partial<RunRecord>) => void
  patchNode: (runId: string, nodeId: string, patch: Partial<NodeRuntime>) => void
}

function seedNode(id: string, status: NodeRuntime['status'], attempt: number, output: string): NodeRuntime {
  return {
    id,
    status,
    attempt,
    output,
    spec: '',
    transcript: output ? [{ id: `${id}-a`, kind: 'assistant', text: output, at: Date.now() - 3600_000 }] : [],
    logs: [],
    finishedAt: status === 'pending' ? undefined : Date.now() - 3600_000,
  }
}

function seedRuns(): RunRecord[] {
  const now = Date.now()
  const doneNodes = ['analyze', 'theme', 'scaffold', 'backend', 'lang', 'gate', 'review'].map((id) =>
    seedNode(id, 'done', id === 'scaffold' ? 2 : 1, id === 'gate' ? 'Cổng đạt. Nhánh review.' : 'Đã xong ở lần chạy trước.'),
  )
  doneNodes.push(seedNode('fix', 'skipped', 0, ''))
  const abortedNodes = ['analyze', 'theme', 'scaffold'].map((id) => seedNode(id, 'done', 1, 'Đã xong trước khi dừng.'))
  abortedNodes.push(seedNode('backend', 'aborted', 1, 'Dừng khi đang viết action_mysql.php.'))
  for (const id of ['lang', 'gate', 'review', 'fix']) abortedNodes.push(seedNode(id, 'pending', 0, ''))
  return [
    {
      id: 'run-4c1e',
      workflowId: 'nukeviet-module',
      projectId: 'news',
      projectName: 'Tin tức',
      module: 'news',
      version: '5.x',
      agentId: 'mock',
      agentName: 'Mock ACP',
      model: 'claude-sonnet-4-6',
      status: 'done',
      live: false,
      branch: 'review',
      createdAt: now - 26 * 3600_000,
      finishedAt: now - 26 * 3600_000 + 64_000,
      nodes: doneNodes,
      evals: Object.fromEntries(EVAL_IDS.map((id) => [id, 'pass'])),
      attention: false,
    },
    {
      id: 'run-9ab2',
      workflowId: 'nukeviet-module',
      projectId: 'news',
      projectName: 'Tin tức',
      module: 'news',
      version: '5.x',
      agentId: 'mock',
      agentName: 'Mock ACP',
      model: 'claude-sonnet-4-6',
      status: 'aborted',
      live: false,
      createdAt: now - 2 * 3600_000,
      finishedAt: now - 2 * 3600_000 + 28_000,
      nodes: abortedNodes,
      evals: Object.fromEntries(EVAL_IDS.map((id) => [id, 'pending'])),
      attention: true,
    },
  ]
}

function seedMessages(lang: Lang): ChatMessage[] {
  const now = Date.now() - 3 * 3600_000
  const welcome = lang === 'en' ? vi.seed.welcomeEn : vi.seed.welcome
  const user = lang === 'en' ? vi.seed.userEn : vi.seed.user
  return [
    { id: 'm-user', role: 'user', text: user, createdAt: now },
    { id: 'm-welcome', role: 'assistant', text: welcome, createdAt: now + 1500, durationMs: 4200, toolCalls: 0 },
  ]
}

function fresh(): Persisted {
  return {
    projects: SEED_PROJECTS,
    activeProjectId: 'news',
    settings: structuredClone(DEFAULT_SETTINGS),
    messages: seedMessages('vi'),
    runs: seedRuns(),
    agentId: 'mock',
    leftWidth: 372,
    rightWidth: 332,
    bottomHeight: 248,
  }
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fresh()
    const parsed = JSON.parse(raw) as Persisted
    parsed.runs = parsed.runs.map((run) =>
      run.status === 'running' ? { ...run, status: 'aborted', live: false, attention: true, finishedAt: run.finishedAt ?? Date.now() } : run,
    )
    parsed.settings = { ...structuredClone(DEFAULT_SETTINGS), ...parsed.settings, agents: parsed.settings.agents?.length ? parsed.settings.agents : DEFAULT_SETTINGS.agents }
    return { ...fresh(), ...parsed }
  } catch {
    return fresh()
  }
}

let persistTimer = 0
function schedulePersist(state: StudioState): void {
  window.clearTimeout(persistTimer)
  persistTimer = window.setTimeout(() => {
    const payload: Persisted = {
      projects: state.projects,
      activeProjectId: state.activeProjectId,
      settings: state.settings,
      messages: state.messages.slice(-80),
      runs: state.runs.slice(0, 20),
      agentId: state.agentId,
      leftWidth: state.leftWidth,
      rightWidth: state.rightWidth,
      bottomHeight: state.bottomHeight,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    localStorage.setItem('nvas.lang', state.settings.lang)
  }, 120)
}

const initial = load()

export const useStudio = create<StudioState>((set, get) => ({
  ...initial,
  openRunId: null,
  activeTab: 'workflow',
  centerView: 'graph',
  rightTab: 'inspector',
  inspectorTab: 'output',
  selectedNodeId: null,
  followRun: true,
  runsTab: 'runs',
  runFilter: 'all',
  runQuery: '',
  settingsOpen: false,
  settingsSection: 'model',
  busy: false,
  secretSaved: false,
  secretStorage: null,
  toast: null,
  set: (patch) => {
    set(patch)
    schedulePersist(get())
  },
  patchSettings: (patch) => {
    set({ settings: { ...get().settings, ...patch } })
    schedulePersist(get())
  },
  patchProject: (id, patch) => {
    set({ projects: get().projects.map((project) => (project.id === id ? { ...project, ...patch } : project)) })
    schedulePersist(get())
  },
  addProject: (project) => {
    set({ projects: [...get().projects, project], activeProjectId: project.id })
    schedulePersist(get())
  },
  addMessage: (message) => {
    set({ messages: [...get().messages, message] })
    schedulePersist(get())
  },
  patchMessage: (id, patch) => {
    set({ messages: get().messages.map((message) => (message.id === id ? { ...message, ...patch } : message)) })
  },
  clearMessages: () => {
    set({ messages: [] })
    schedulePersist(get())
  },
  upsertRun: (run) => {
    const exists = get().runs.some((item) => item.id === run.id)
    set({ runs: exists ? get().runs.map((item) => (item.id === run.id ? run : item)) : [run, ...get().runs] })
    schedulePersist(get())
  },
  patchRun: (id, patch) => {
    set({ runs: get().runs.map((run) => (run.id === id ? { ...run, ...patch } : run)) })
    schedulePersist(get())
  },
  patchNode: (runId, nodeId, patch) => {
    set({
      runs: get().runs.map((run) =>
        run.id !== runId
          ? run
          : { ...run, nodes: run.nodes.map((node) => (node.id === nodeId ? { ...node, ...patch } : node)) },
      ),
    })
  },
}))

export function activeProject(): Project {
  const state = useStudio.getState()
  return state.projects.find((project) => project.id === state.activeProjectId) ?? state.projects[0]
}

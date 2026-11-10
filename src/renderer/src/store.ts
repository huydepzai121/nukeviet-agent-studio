import { create } from 'zustand'
import { DEFAULT_SETTINGS, mergeAgents } from '@shared/defaults'
import { normalizeSnapshot, type AdeSnapshot } from '@shared/snapshot'
import { titleFromMessage } from '@shared/threads'
import type { ChatMessage, NodeRuntime, Project, RunRecord, Settings, Thread, ThreadMode } from '@shared/types'

const STORAGE_KEY = 'nvas.ade.v2'

export type RunFilter = 'active' | 'attention' | 'live' | 'finished' | 'all'
export type SettingsSection = 'model' | 'agents' | 'project' | 'language'
export type CenterView = 'graph' | 'review' | 'messages'
export type InspectorTab = 'spec' | 'output' | 'transcript' | 'logs'

interface StudioState {
  projects: Project[]
  threads: Thread[]
  activeProjectId: string | null
  activeThreadId: string | null
  settings: Settings
  messages: ChatMessage[]
  runs: RunRecord[]
  agentId: string
  mode: ThreadMode
  filesOpen: boolean
  leftWidth: number
  rightWidth: number
  bottomHeight: number
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
  paletteOpen: boolean
  cloneOpen: boolean
  busy: boolean
  secretSaved: boolean
  secretStorage: 'safeStorage' | 'aes' | 'memory' | null
  toast: string | null
  hydrated: boolean
  set: (patch: Partial<StudioState>) => void
  patchSettings: (patch: Partial<Settings>) => void
  patchProject: (id: string, patch: Partial<Project>) => void
  addProject: (project: Project) => void
  removeProject: (id: string) => void
  addThread: (thread: Thread) => void
  selectThread: (id: string) => void
  patchThread: (id: string, patch: Partial<Thread>) => void
  removeThread: (id: string) => void
  addMessage: (message: ChatMessage) => void
  patchMessage: (id: string, patch: Partial<ChatMessage>) => void
  clearMessages: () => void
  upsertRun: (run: RunRecord) => void
  patchRun: (id: string, patch: Partial<RunRecord>) => void
  patchNode: (runId: string, nodeId: string, patch: Partial<NodeRuntime>) => void
  applySnapshot: (snapshot: AdeSnapshot) => void
}

function blank(): Pick<StudioState, 'projects' | 'threads' | 'activeProjectId' | 'activeThreadId' | 'settings' | 'messages' | 'runs' | 'agentId' | 'mode' | 'filesOpen' | 'leftWidth' | 'rightWidth' | 'bottomHeight'> {
  return {
    projects: [],
    threads: [],
    activeProjectId: null,
    activeThreadId: null,
    settings: structuredClone(DEFAULT_SETTINGS),
    messages: [],
    runs: [],
    agentId: 'mock',
    mode: 'chat',
    filesOpen: true,
    leftWidth: 268,
    rightWidth: 332,
    bottomHeight: 228,
  }
}

function snapshotOf(state: StudioState): AdeSnapshot {
  return {
    version: 2,
    projects: state.projects,
    threads: state.threads.map((thread) => ({ ...thread, messages: thread.messages.slice(-120) })),
    activeProjectId: state.activeProjectId,
    activeThreadId: state.activeThreadId,
    settings: state.settings,
    runs: state.runs.slice(0, 20),
    mode: state.mode,
    filesOpen: state.filesOpen,
    agentId: state.agentId,
  }
}

function viewFrom(snapshot: AdeSnapshot) {
  const thread = snapshot.threads.find((item) => item.id === snapshot.activeThreadId) ?? null
  return {
    ...snapshot,
    settings: { ...snapshot.settings, agents: mergeAgents(snapshot.settings.agents) },
    messages: thread?.messages ?? [],
    agentId: thread?.agentId || snapshot.agentId || 'mock',
  }
}

function loadLocal(): ReturnType<typeof blank> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...blank(), ...viewFrom(normalizeSnapshot(JSON.parse(raw))) }
    const legacy = localStorage.getItem('nvas.v1')
    if (!legacy) return blank()
    const parsed = JSON.parse(legacy) as Partial<AdeSnapshot> & { messages?: ChatMessage[]; activeProjectId?: string }
    const snapshot = normalizeSnapshot({
      ...parsed,
      threads: [],
      activeThreadId: null,
      mode: 'workflow',
      filesOpen: false,
    })
    return { ...blank(), ...viewFrom(snapshot), leftWidth: 268, rightWidth: 332, bottomHeight: 228 }
  } catch {
    return blank()
  }
}

let persistTimer = 0
function schedulePersist(state: StudioState): void {
  window.clearTimeout(persistTimer)
  persistTimer = window.setTimeout(() => {
    const payload = snapshotOf(state)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
      localStorage.setItem('nvas.lang', state.settings.lang)
    } catch {
      /* private mode */
    }
    void window.studio?.saveState(payload)
  }, 160)
}

function withThreadMessages(state: StudioState, messages: ChatMessage[], touchTitle: ChatMessage | null): Pick<StudioState, 'messages' | 'threads'> {
  const threads = state.threads.map((thread) => {
    if (thread.id !== state.activeThreadId) return thread
    let title = thread.title
    let autoTitle = thread.autoTitle
    if (touchTitle && thread.autoTitle && touchTitle.role === 'user') {
      title = titleFromMessage(touchTitle.text)
      autoTitle = false
    }
    return { ...thread, messages, title, autoTitle, updatedAt: Date.now() }
  })
  return { messages, threads }
}

const initial = loadLocal()

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
  paletteOpen: false,
  cloneOpen: false,
  busy: false,
  secretSaved: false,
  secretStorage: null,
  toast: null,
  hydrated: false,
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
    const exists = get().projects.find((item) => item.path === project.path)
    if (exists) {
      set({ activeProjectId: exists.id, projects: get().projects.map((item) => (item.id === exists.id ? { ...item, ...project, id: exists.id } : item)) })
    } else {
      set({ projects: [project, ...get().projects], activeProjectId: project.id })
    }
    schedulePersist(get())
  },
  removeProject: (id) => {
    const projects = get().projects.filter((project) => project.id !== id)
    const threads = get().threads.filter((thread) => thread.projectId !== id)
    const activeProjectId = get().activeProjectId === id ? (projects[0]?.id ?? null) : get().activeProjectId
    const nextThread = threads.find((thread) => thread.projectId === activeProjectId) ?? null
    set({
      projects,
      threads,
      activeProjectId,
      activeThreadId: nextThread?.id ?? null,
      messages: nextThread?.messages ?? [],
      agentId: nextThread?.agentId ?? get().agentId,
    })
    schedulePersist(get())
  },
  addThread: (thread) => {
    set({
      threads: [thread, ...get().threads],
      activeThreadId: thread.id,
      activeProjectId: thread.projectId,
      messages: thread.messages,
      agentId: thread.agentId,
      mode: 'chat',
    })
    schedulePersist(get())
  },
  selectThread: (id) => {
    const thread = get().threads.find((item) => item.id === id)
    if (!thread) return
    set({ activeThreadId: id, activeProjectId: thread.projectId, messages: thread.messages, agentId: thread.agentId })
    schedulePersist(get())
  },
  patchThread: (id, patch) => {
    const threads = get().threads.map((thread) => (thread.id === id ? { ...thread, ...patch, updatedAt: Date.now() } : thread))
    const active = threads.find((thread) => thread.id === get().activeThreadId)
    set({
      threads,
      ...(active && id === active.id ? { messages: active.messages, agentId: active.agentId } : {}),
    })
    schedulePersist(get())
  },
  removeThread: (id) => {
    const threads = get().threads.filter((thread) => thread.id !== id)
    if (get().activeThreadId !== id) {
      set({ threads })
      schedulePersist(get())
      return
    }
    const projectId = get().activeProjectId
    const next = threads.find((thread) => thread.projectId === projectId) ?? null
    set({
      threads,
      activeThreadId: next?.id ?? null,
      messages: next?.messages ?? [],
      agentId: next?.agentId ?? get().agentId,
    })
    schedulePersist(get())
  },
  addMessage: (message) => {
    const messages = [...get().messages, message]
    set(withThreadMessages(get(), messages, message))
    schedulePersist(get())
  },
  patchMessage: (id, patch) => {
    const messages = get().messages.map((message) => (message.id === id ? { ...message, ...patch } : message))
    set(withThreadMessages(get(), messages, null))
    schedulePersist(get())
  },
  clearMessages: () => {
    set(withThreadMessages(get(), [], null))
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
        run.id !== runId ? run : { ...run, nodes: run.nodes.map((node) => (node.id === nodeId ? { ...node, ...patch } : node)) },
      ),
    })
  },
  applySnapshot: (snapshot) => {
    const view = viewFrom(normalizeSnapshot(snapshot))
    set({ ...view, hydrated: true })
  },
}))

export function activeProject(): Project | null {
  const state = useStudio.getState()
  if (!state.activeProjectId) return null
  return state.projects.find((project) => project.id === state.activeProjectId) ?? null
}

export function activeThread(): Thread | null {
  const state = useStudio.getState()
  if (!state.activeThreadId) return null
  return state.threads.find((thread) => thread.id === state.activeThreadId) ?? null
}

let hydrateOnce: Promise<void> | null = null

export function hydrateStudio(): Promise<void> {
  if (!hydrateOnce) {
    hydrateOnce = (async () => {
      if (window.studio) {
        try {
          const disk = await window.studio.loadState()
          if (disk) useStudio.getState().applySnapshot(disk)
        } catch {
          /* keep local */
        }
      }
      useStudio.setState({ hydrated: true })
    })()
  }
  return hydrateOnce
}

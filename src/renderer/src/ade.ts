import { SEED_PROJECTS } from '@shared/defaults'
import { makeThread, workspacePath } from '@shared/threads'
import type { Project, ProjectInspect } from '@shared/types'
import i18n from './i18n'
import { uid } from './lib/format'
import { activeProject, activeThread, useStudio } from './store'

export function modKey(): string {
  return window.studio?.platform === 'darwin' ? '⌘' : 'Ctrl'
}

function projectFromInspect(info: ProjectInspect): Project {
  return {
    id: uid('prj'),
    name: info.name,
    module: info.module,
    version: info.version,
    path: info.path,
    detected: info.detected,
    branch: info.branch,
    dirty: info.dirty,
    repo: info.repo,
    lastOpenedAt: Date.now(),
  }
}

export function openProjectRecord(project: Project): void {
  const state = useStudio.getState()
  state.addProject({ ...project, lastOpenedAt: Date.now() })
  const current = useStudio.getState()
  const id = current.projects.find((item) => item.path === project.path)?.id ?? project.id
  const existing = current.threads.find((thread) => thread.projectId === id)
  if (!existing) {
    const thread = makeThread(id, 'mock', uid('th'))
    thread.title = i18n.t('ade.newChat')
    current.addThread(thread)
  } else {
    current.selectThread(existing.id)
  }
  useStudio.getState().set({ mode: 'chat', filesOpen: !project.virtual, paletteOpen: false, cloneOpen: false })
}

export async function openFolder(): Promise<void> {
  if (!window.studio) {
    useStudio.getState().set({ toast: i18n.t('ade.desktopOnly') })
    return
  }
  const folder = await window.studio.pickFolder()
  if (!folder) return
  const info = await window.studio.inspectProject(folder)
  openProjectRecord(projectFromInspect(info))
}

export async function finishClone(folder: string): Promise<void> {
  if (!window.studio) return
  const info = await window.studio.inspectProject(folder)
  openProjectRecord(projectFromInspect(info))
}

export function newChat(): void {
  const project = activeProject()
  if (!project) {
    void openFolder()
    return
  }
  const thread = makeThread(project.id, useStudio.getState().agentId || 'mock', uid('th'))
  thread.title = i18n.t('ade.newChat')
  useStudio.getState().addThread(thread)
}

export function openSample(): void {
  const seed = SEED_PROJECTS[0]
  const state = useStudio.getState()
  if (!state.projects.some((project) => project.id === seed.id)) {
    state.addProject({ ...seed, virtual: true, detected: seed.version, lastOpenedAt: Date.now() })
  } else {
    state.set({ activeProjectId: seed.id })
  }
  const fresh = useStudio.getState()
  if (!fresh.threads.some((thread) => thread.projectId === seed.id)) {
    fresh.addThread({
      ...makeThread(seed.id, 'mock', uid('th')),
      title: seed.name,
      autoTitle: false,
      messages: [],
    })
  }
  useStudio.getState().set({ mode: 'workflow', filesOpen: false })
}

export async function isolateThread(): Promise<void> {
  const project = activeProject()
  const thread = activeThread()
  if (!project || !thread || project.virtual || !window.studio) {
    useStudio.getState().set({ toast: i18n.t('ade.desktopOnly') })
    return
  }
  try {
    const created = await window.studio.createWorktree(project.path, thread.title, thread.id)
    useStudio.getState().patchThread(thread.id, { worktreePath: created.path, worktreeBranch: created.branch })
    useStudio.getState().set({ toast: i18n.t('ade.worktreeDone', { branch: created.branch }) })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    useStudio.getState().set({ toast: message })
  }
}

export function currentCwd(): string {
  const project = activeProject()
  if (!project) return ''
  return workspacePath(project.path, activeThread())
}

export interface PaletteItem {
  id: string
  label: string
  hint?: string
  kbd?: string
  run: () => void
}

export function paletteItems(): PaletteItem[] {
  const state = useStudio.getState()
  const key = modKey()
  const items: PaletteItem[] = [
    { id: 'new-chat', label: i18n.t('ade.newChat'), kbd: `${key}+N`, run: () => newChat() },
    { id: 'open', label: i18n.t('ade.openFolder'), run: () => void openFolder() },
    { id: 'clone', label: i18n.t('ade.clone'), run: () => state.set({ cloneOpen: true, paletteOpen: false }) },
    { id: 'settings', label: i18n.t('app.settings'), kbd: `${key}+,`, run: () => state.set({ settingsOpen: true, paletteOpen: false }) },
    { id: 'chat', label: i18n.t('ade.modeChat'), kbd: `${key}+1`, run: () => state.set({ mode: 'chat', paletteOpen: false }) },
    { id: 'workflow', label: i18n.t('ade.modeWorkflow'), kbd: `${key}+2`, run: () => state.set({ mode: 'workflow', paletteOpen: false }) },
    { id: 'diff', label: i18n.t('ade.modeDiff'), kbd: `${key}+3`, run: () => state.set({ mode: 'diff', paletteOpen: false }) },
    { id: 'terminal', label: i18n.t('ade.modeTerminal'), kbd: `${key}+4`, run: () => state.set({ mode: 'terminal', paletteOpen: false }) },
    { id: 'files', label: i18n.t('ade.files'), run: () => state.set({ filesOpen: !state.filesOpen, paletteOpen: false }) },
    { id: 'worktree', label: i18n.t('ade.worktree'), run: () => void isolateThread() },
    { id: 'sample', label: i18n.t('ade.sample'), run: () => openSample() },
  ]
  for (const project of state.projects) {
    items.push({
      id: `project-${project.id}`,
      label: project.name,
      hint: project.path,
      run: () => openProjectRecord(project),
    })
  }
  for (const thread of state.threads) {
    items.push({
      id: `thread-${thread.id}`,
      label: thread.title,
      hint: i18n.t('ade.newChat'),
      run: () => {
        state.selectThread(thread.id)
        state.set({ paletteOpen: false, mode: 'chat' })
      },
    })
  }
  return items
}

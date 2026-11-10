import { contextBridge, ipcRenderer } from 'electron'
import type { StudioBridge } from '@shared/bridge'
import type { AgentEvent, AgentTask, ProviderTestRequest, Settings } from '@shared/types'
import type { AdeSnapshot } from '@shared/snapshot'

function listen<T>(channel: string, listener: (payload: T) => void): () => void {
  const wrapped = (_event: unknown, payload: T) => listener(payload)
  ipcRenderer.on(channel, wrapped)
  return () => ipcRenderer.removeListener(channel, wrapped)
}

const launch = { speed: 1 }

const api: StudioBridge = {
  platform: process.platform,
  isElectron: true,
  launch,
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  secretStatus: () => ipcRenderer.invoke('secret:status'),
  saveSecret: (key) => ipcRenderer.invoke('secret:save', key),
  clearSecret: () => ipcRenderer.invoke('secret:clear'),
  testProvider: (request: ProviderTestRequest) => ipcRenderer.invoke('provider:test', request),
  runAgent: (task: AgentTask, settings: Settings) => ipcRenderer.invoke('agent:run', task, settings),
  cancelAgent: (requestId) => ipcRenderer.invoke('agent:cancel', requestId),
  respondPermission: (requestId, optionId) => ipcRenderer.invoke('agent:permission', requestId, optionId),
  closeSession: (threadId) => ipcRenderer.invoke('agent:close-session', threadId),
  onAgentEvent: (listener) => listen('agent:event', listener),
  pickFolder: () => ipcRenderer.invoke('dialog:folder'),
  inspectProject: (folder) => ipcRenderer.invoke('project:inspect', folder),
  cloneRepo: (input) => ipcRenderer.invoke('git:clone', input),
  cancelClone: () => ipcRenderer.invoke('git:clone-cancel'),
  onCloneProgress: (listener) => listen('git:clone-progress', listener),
  gitStatus: (cwd) => ipcRenderer.invoke('git:status', cwd),
  gitDiff: (cwd) => ipcRenderer.invoke('git:diff', cwd),
  gitFileAction: (cwd, file, action) => ipcRenderer.invoke('git:action', cwd, file, action),
  listDir: (cwd, rel) => ipcRenderer.invoke('fs:list', cwd, rel ?? ''),
  createWorktree: (repo, title, threadId) => ipcRenderer.invoke('git:worktree', repo, title, threadId),
  terminalOpen: (cwd) => ipcRenderer.invoke('terminal:open', cwd),
  terminalWrite: (id, data) => ipcRenderer.invoke('terminal:write', id, data),
  terminalResize: (id, cols, rows) => ipcRenderer.invoke('terminal:resize', id, cols, rows),
  terminalClose: (id) => ipcRenderer.invoke('terminal:close', id),
  onTerminal: (listener) => listen('terminal:data', listener),
  loadState: () => ipcRenderer.invoke('state:load'),
  saveState: (snapshot: AdeSnapshot) => ipcRenderer.invoke('state:save', snapshot),
}

void ipcRenderer.invoke('app:launch').then((value: { speed?: number } | null) => {
  if (value?.speed) launch.speed = value.speed
})

contextBridge.exposeInMainWorld('studio', api)

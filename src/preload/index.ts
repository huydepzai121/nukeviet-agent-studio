import { contextBridge, ipcRenderer } from 'electron'
import type { StudioBridge } from '@shared/bridge'
import type { AgentEvent, AgentTask, ProviderTestRequest, Settings } from '@shared/types'

const api: StudioBridge = {
  platform: process.platform,
  isElectron: true,
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  secretStatus: () => ipcRenderer.invoke('secret:status'),
  saveSecret: (key) => ipcRenderer.invoke('secret:save', key),
  clearSecret: () => ipcRenderer.invoke('secret:clear'),
  testProvider: (request) => ipcRenderer.invoke('provider:test', request),
  runAgent: (task, settings) => ipcRenderer.invoke('agent:run', task, settings),
  cancelAgent: (requestId) => ipcRenderer.invoke('agent:cancel', requestId),
  onAgentEvent: (listener) => {
    const channel = 'agent:event'
    const wrapped = (_event: unknown, payload: { requestId: string; event: AgentEvent }) => listener(payload)
    ipcRenderer.on(channel, wrapped)
    return () => ipcRenderer.removeListener(channel, wrapped)
  },
}

contextBridge.exposeInMainWorld('studio', api)

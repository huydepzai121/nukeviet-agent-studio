import type { AgentEvent, AgentTask, ProviderTestRequest, ProviderTestResult, SecretSaveResult, Settings } from './types'

export interface StudioBridge {
  platform: string
  isElectron: true
  minimize: () => Promise<void>
  maximize: () => Promise<void>
  close: () => Promise<void>
  secretStatus: () => Promise<{ saved: boolean; storage: 'safeStorage' | 'aes' | null }>
  saveSecret: (key: string) => Promise<SecretSaveResult>
  clearSecret: () => Promise<{ ok: boolean }>
  testProvider: (request: ProviderTestRequest) => Promise<ProviderTestResult>
  runAgent: (task: AgentTask, settings: Settings) => Promise<{ stopReason: string; text: string; sessionId: string }>
  cancelAgent: (requestId: string) => Promise<{ ok: boolean }>
  onAgentEvent: (listener: (payload: { requestId: string; event: AgentEvent }) => void) => () => void
}

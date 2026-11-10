import type { AdeSnapshot } from './snapshot'
import type {
  AgentEvent,
  AgentTask,
  DiffFile,
  DirEntry,
  GitStatusInfo,
  ProjectInspect,
  ProviderTestRequest,
  ProviderTestResult,
  SecretSaveResult,
  Settings,
} from './types'

export interface StudioBridge {
  platform: string
  isElectron: true
  launch: { speed: number }
  minimize: () => Promise<void>
  maximize: () => Promise<void>
  close: () => Promise<void>
  secretStatus: () => Promise<{ saved: boolean; storage: 'safeStorage' | 'aes' | null }>
  saveSecret: (key: string) => Promise<SecretSaveResult>
  clearSecret: () => Promise<{ ok: boolean }>
  testProvider: (request: ProviderTestRequest) => Promise<ProviderTestResult>
  runAgent: (task: AgentTask, settings: Settings) => Promise<{ stopReason: string; text: string; sessionId: string }>
  cancelAgent: (requestId: string) => Promise<{ ok: boolean }>
  respondPermission: (requestId: string, optionId: string | null) => Promise<{ ok: boolean }>
  closeSession: (threadId: string) => Promise<{ ok: boolean }>
  onAgentEvent: (listener: (payload: { requestId: string; event: AgentEvent }) => void) => () => void
  pickFolder: () => Promise<string | null>
  inspectProject: (folder: string) => Promise<ProjectInspect>
  cloneRepo: (input: { url: string; parentDir: string; shallow: boolean; branch?: string }) => Promise<{ path: string }>
  cancelClone: () => Promise<{ ok: boolean }>
  onCloneProgress: (listener: (payload: { line: string; done?: boolean; error?: string }) => void) => () => void
  gitStatus: (cwd: string) => Promise<GitStatusInfo>
  gitDiff: (cwd: string) => Promise<DiffFile[]>
  gitFileAction: (cwd: string, file: string, action: 'accept' | 'revert') => Promise<{ ok: boolean }>
  listDir: (cwd: string, rel?: string) => Promise<DirEntry[]>
  createWorktree: (repo: string, title: string, threadId: string) => Promise<{ path: string; branch: string }>
  terminalOpen: (cwd: string) => Promise<{ id: string }>
  terminalWrite: (id: string, data: string) => Promise<void>
  terminalResize: (id: string, cols: number, rows: number) => Promise<void>
  terminalClose: (id: string) => Promise<void>
  onTerminal: (listener: (payload: { id: string; data: string }) => void) => () => void
  loadState: () => Promise<AdeSnapshot | null>
  saveState: (snapshot: AdeSnapshot) => Promise<{ ok: boolean }>
}

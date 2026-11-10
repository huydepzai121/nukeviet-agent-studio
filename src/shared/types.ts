export type NvVersion = '4.x' | '5.x'
export type Lang = 'vi' | 'en'
export type GatewayMode = 'both' | 'openai' | 'anthropic'

export type NodeKind = 'step' | 'gate'
export type NodeStatus = 'idle' | 'pending' | 'running' | 'done' | 'failed' | 'aborted' | 'skipped'
export type RunStatus = 'running' | 'done' | 'failed' | 'aborted'
export type EvalState = 'pending' | 'pass' | 'fail'

export type DetectedVersion = NvVersion | 'unknown'
export type ThreadMode = 'chat' | 'workflow' | 'diff' | 'terminal'

export interface Project {
  id: string
  name: string
  module: string
  version: NvVersion
  path: string
  detected?: DetectedVersion
  branch?: string
  dirty?: boolean
  repo?: boolean
  lastOpenedAt?: number
  virtual?: boolean
}

export interface ChatPart {
  id: string
  kind: 'text' | 'tool' | 'plan' | 'permission' | 'thought'
  text?: string
  toolId?: string
  toolStatus?: 'in_progress' | 'completed' | 'failed'
  entries?: { content: string; status: string; priority?: string }[]
  title?: string
  options?: { id: string; name: string; kind: string }[]
  selected?: string
}

export interface Thread {
  id: string
  projectId: string
  title: string
  autoTitle: boolean
  agentId: string
  createdAt: number
  updatedAt: number
  messages: ChatMessage[]
  worktreePath?: string
  worktreeBranch?: string
}

export interface AgentProfile {
  id: string
  name: string
  builtin: boolean
  command: string
}

export interface Settings {
  gateway: GatewayMode
  baseUrl: string
  model: string
  models: string[]
  agents: AgentProfile[]
  lang: Lang
}

export interface WorkflowNodeDef {
  id: string
  kind: NodeKind
  agent: string
  x: number
  y: number
}

export interface WorkflowEdgeDef {
  id: string
  source: string
  target: string
  sourceHandle?: string
  when?: 'review' | 'fix'
}

export interface LogLine {
  id: string
  at: number
  level: 'info' | 'warn' | 'error'
  message: string
}

export interface TranscriptItem {
  id: string
  kind: 'user' | 'assistant' | 'tool'
  text: string
  toolStatus?: 'in_progress' | 'completed' | 'failed'
  at: number
}

export interface NodeRuntime {
  id: string
  status: NodeStatus
  attempt: number
  output: string
  spec: string
  transcript: TranscriptItem[]
  logs: LogLine[]
  startedAt?: number
  finishedAt?: number
}

export interface RunRecord {
  id: string
  workflowId: string
  projectId: string
  projectName: string
  module: string
  version: NvVersion
  agentId: string
  agentName: string
  model: string
  status: RunStatus
  live: boolean
  branch?: 'review' | 'fix'
  createdAt: number
  finishedAt?: number
  nodes: NodeRuntime[]
  evals: Record<string, EvalState>
  attention: boolean
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  createdAt: number
  pending?: boolean
  durationMs?: number
  toolCalls?: number
  stopped?: boolean
  parts?: ChatPart[]
}

export interface MockTask {
  kind: 'node' | 'chat'
  nodeId?: string
  attempt: number
  version: NvVersion
  module: string
  title: string
  lang: Lang
  text: string
}

export interface MockTool {
  id: string
  title: string
  kind: 'read' | 'edit' | 'search' | 'execute' | 'think'
}

export interface MockTurnResult {
  status: 'ok' | 'failed'
  branch?: 'review' | 'fix'
  summary: string
  text: string
  tools: MockTool[]
  logs: { level: 'info' | 'warn' | 'error'; message: string }[]
}

export interface AgentTask {
  requestId: string
  agentId: string
  model: string
  cwd: string
  prompt: string
  speed: number
  threadId?: string
  autoApprove?: boolean
}

export interface PermissionOptionView {
  id: string
  name: string
  kind: string
}

export type AgentEvent =
  | { type: 'text'; text: string }
  | { type: 'thought'; text: string }
  | { type: 'tool'; id: string; title: string; status: 'in_progress' | 'completed' | 'failed' }
  | { type: 'plan'; entries: { content: string; status: string; priority?: string }[] }
  | { type: 'permission'; title: string; options: PermissionOptionView[] }
  | { type: 'done'; stopReason: string }

export interface ProjectInspect {
  name: string
  path: string
  module: string
  version: NvVersion
  detected: DetectedVersion
  notes: string[]
  branch: string
  dirty: boolean
  repo: boolean
}

export interface DiffFile {
  path: string
  additions: number
  deletions: number
  untracked: boolean
  binary: boolean
  patch: string
}

export interface DirEntry {
  name: string
  path: string
  kind: 'file' | 'dir'
}

export interface GitStatusInfo {
  branch: string
  dirty: boolean
  repo: boolean
}

export interface ProviderTestRequest {
  gateway: GatewayMode
  baseUrl: string
  model: string
  apiKey?: string
}

export interface ProviderTestResult {
  ok: boolean
  message: string
}

export interface SecretSaveResult {
  storage: 'safeStorage' | 'aes' | 'memory'
}

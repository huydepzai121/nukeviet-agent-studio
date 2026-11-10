export type NvVersion = '4.x' | '5.x'
export type Lang = 'vi' | 'en'
export type GatewayMode = 'both' | 'openai' | 'anthropic'

export type NodeKind = 'step' | 'gate'
export type NodeStatus = 'idle' | 'pending' | 'running' | 'done' | 'failed' | 'aborted' | 'skipped'
export type RunStatus = 'running' | 'done' | 'failed' | 'aborted'
export type EvalState = 'pending' | 'pass' | 'fail'

export interface Project {
  id: string
  name: string
  module: string
  version: NvVersion
  path: string
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
}

export type AgentEvent =
  | { type: 'text'; text: string }
  | { type: 'tool'; id: string; title: string; status: 'in_progress' | 'completed' | 'failed' }
  | { type: 'done'; stopReason: string }

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

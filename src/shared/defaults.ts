import type { AgentProfile, Project, Settings } from './types'

export const DEFAULT_MODELS = ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5-20251001']

export const DEFAULT_AGENTS: AgentProfile[] = [
  { id: 'mock', name: 'Mock ACP', builtin: true, command: '' },
  { id: 'claude', name: 'Claude Code', builtin: false, command: 'npx -y @agentclientprotocol/claude-agent-acp' },
  { id: 'codex', name: 'Codex', builtin: false, command: 'npx -y @agentclientprotocol/codex-acp' },
  { id: 'gemini', name: 'Gemini CLI', builtin: false, command: 'gemini --acp' },
  { id: 'custom', name: 'Custom', builtin: false, command: '' },
]

export function mergeAgents(saved: AgentProfile[] | undefined): AgentProfile[] {
  const base = DEFAULT_AGENTS.map((agent) => {
    const found = saved?.find((item) => item.id === agent.id)
    if (!found) return { ...agent }
    return {
      ...agent,
      command: typeof found.command === 'string' ? found.command : agent.command,
      name: agent.builtin ? agent.name : found.name?.trim() || agent.name,
    }
  })
  const extras = (saved ?? []).filter((agent) => agent?.id && agent.name && !DEFAULT_AGENTS.some((item) => item.id === agent.id))
  return [...base, ...extras.map((agent) => ({ id: agent.id, name: agent.name, builtin: false, command: agent.command || '' }))]
}

export const DEFAULT_SETTINGS: Settings = {
  gateway: 'both',
  baseUrl: 'https://bedrock.viber.vn/v1',
  model: DEFAULT_MODELS[0],
  models: [...DEFAULT_MODELS],
  agents: DEFAULT_AGENTS.map((agent) => ({ ...agent })),
  lang: 'vi',
}

export const SEED_PROJECTS: Project[] = [
  {
    id: 'news',
    name: 'Tin tức',
    module: 'news',
    version: '5.x',
    path: '/projects/nukeviet/src/modules/news',
  },
  {
    id: 'contact',
    name: 'Liên hệ',
    module: 'contact',
    version: '4.x',
    path: '/projects/nukeviet4/modules/contact',
  },
]

export function agentById(settings: Settings, id: string): AgentProfile {
  return settings.agents.find((agent) => agent.id === id) ?? settings.agents[0]
}

import { chunkText, mockTurn, parseTask } from '@shared/mock-script'
import { encodeTurn } from '@shared/parse'
import { sleep } from '@shared/timing'
import type { AgentEvent, AgentTask, Settings } from '@shared/types'
import type { EngineHost } from '@shared/engine'
import { useStudio } from './store'

const listeners = new Map<string, (event: AgentEvent) => void>()
let installed = false

export function installHost(): void {
  if (installed || !window.studio) return
  installed = true
  window.studio.onAgentEvent(({ requestId, event }) => {
    listeners.get(requestId)?.(event)
  })
}

export function createHost(): EngineHost {
  if (window.studio) return { runAgent: electronRun }
  return { runAgent: browserRun }
}

async function electronRun(
  input: { requestId: string; prompt: string; cwd: string; agentId: string; model: string },
  onEvent: (event: AgentEvent) => void,
  signal: AbortSignal,
): Promise<{ stopReason: string; text: string }> {
  installHost()
  const studio = window.studio
  if (!studio) return browserRun(input, onEvent, signal)
  const state = useStudio.getState()
  const task: AgentTask = {
    requestId: input.requestId,
    agentId: input.agentId,
    model: input.model,
    cwd: input.cwd,
    prompt: input.prompt,
    speed: Number(new URLSearchParams(location.search).get('speed') || '1') || 1,
  }
  listeners.set(input.requestId, onEvent)
  const onAbort = () => {
    void studio.cancelAgent(input.requestId)
  }
  signal.addEventListener('abort', onAbort, { once: true })
  try {
    const result = await studio.runAgent(task, publicSettings(state.settings))
    return { stopReason: result.stopReason, text: result.text }
  } finally {
    listeners.delete(input.requestId)
    signal.removeEventListener('abort', onAbort)
  }
}

async function browserRun(
  input: { requestId: string; prompt: string },
  onEvent: (event: AgentEvent) => void,
  signal: AbortSignal,
): Promise<{ stopReason: string; text: string }> {
  const turn = mockTurn(parseTask(input.prompt))
  const encoded = encodeTurn(turn)
  for (const tool of turn.tools) {
    onEvent({ type: 'tool', id: tool.id, title: tool.title, status: 'in_progress' })
    await sleep(220, signal)
    onEvent({ type: 'tool', id: tool.id, title: tool.title, status: 'completed' })
  }
  for (const piece of chunkText(encoded, 32)) {
    onEvent({ type: 'text', text: piece })
    await sleep(18, signal)
  }
  onEvent({ type: 'done', stopReason: 'end_turn' })
  return { stopReason: 'end_turn', text: encoded }
}

function publicSettings(settings: Settings): Settings {
  return {
    gateway: settings.gateway,
    baseUrl: settings.baseUrl,
    model: settings.model,
    models: settings.models,
    agents: settings.agents,
    lang: settings.lang,
  }
}

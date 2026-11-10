import { spawn, type ChildProcess } from 'node:child_process'
import { Readable, Writable } from 'node:stream'
import path from 'node:path'
import * as acp from '@agentclientprotocol/sdk'
import type { AgentEvent, PermissionOptionView } from '@shared/types'

export interface PermissionAsk {
  title: string
  options: PermissionOptionView[]
}

export interface TurnRequest {
  command: string
  args: string[]
  cwd: string
  env: NodeJS.ProcessEnv
  prompt: string
  signal?: AbortSignal
  onEvent?: (event: AgentEvent) => void
  autoApprove?: boolean
  onPermission?: (request: PermissionAsk) => Promise<string | null>
}

export interface TurnResult {
  stopReason: string
  text: string
  sessionId: string
}

export function mapToolStatus(status: string | null | undefined): 'in_progress' | 'completed' | 'failed' {
  if (status === 'failed') return 'failed'
  if (status === 'completed') return 'completed'
  return 'in_progress'
}

export async function readPromptTurn(
  session: acp.ActiveSession,
  prompt: string,
  hooks: { onEvent?: (event: AgentEvent) => void; signal?: AbortSignal },
): Promise<TurnResult> {
  const pending = session.prompt(prompt)
  let text = ''
  const seenTools = new Set<string>()
  while (true) {
    if (hooks.signal?.aborted) throw new DOMException('aborted', 'AbortError')
    const message = await session.nextUpdate()
    if (message.kind === 'stop') {
      hooks.onEvent?.({ type: 'done', stopReason: message.stopReason })
      break
    }
    const update = message.update
    if ((update.sessionUpdate === 'agent_message_chunk' || update.sessionUpdate === 'agent_thought_chunk') && update.content.type === 'text') {
      if (update.sessionUpdate === 'agent_message_chunk') {
        text += update.content.text
        hooks.onEvent?.({ type: 'text', text: update.content.text })
      } else {
        hooks.onEvent?.({ type: 'thought', text: update.content.text })
      }
    } else if (update.sessionUpdate === 'tool_call') {
      if (!seenTools.has(update.toolCallId)) seenTools.add(update.toolCallId)
      hooks.onEvent?.({
        type: 'tool',
        id: update.toolCallId,
        title: update.title,
        status: mapToolStatus(update.status),
      })
    } else if (update.sessionUpdate === 'tool_call_update') {
      hooks.onEvent?.({
        type: 'tool',
        id: update.toolCallId,
        title: update.title || update.toolCallId,
        status: mapToolStatus(update.status),
      })
    } else if (update.sessionUpdate === 'plan') {
      hooks.onEvent?.({
        type: 'plan',
        entries: update.entries.map((entry) => ({ content: entry.content, status: entry.status, priority: entry.priority })),
      })
    }
  }
  const response = await pending
  return { stopReason: response.stopReason, text, sessionId: session.sessionId }
}

export function permissionDecision(
  options: { optionId: string; name: string; kind: string }[],
  optionId: string | null,
): { outcome: { outcome: 'cancelled' } } | { outcome: { outcome: 'selected'; optionId: string } } {
  if (!optionId || !options.some((option) => option.optionId === optionId)) return { outcome: { outcome: 'cancelled' } }
  return { outcome: { outcome: 'selected', optionId } }
}

export function autoPermission(options: { optionId: string; kind: string }[]): string | null {
  const allow = options.find((option) => option.kind === 'allow_once' || option.kind === 'allow_always') ?? options[0]
  return allow?.optionId ?? null
}

function wirePermission(
  app: ReturnType<typeof acp.client>,
  current: () => { onEvent?: (event: AgentEvent) => void; autoApprove?: boolean; onPermission?: TurnRequest['onPermission'] } | null,
) {
  return app.onRequest(acp.methods.client.session.requestPermission, async (ctx) => {
    const options = ctx.params.options.map((option) => ({ id: option.optionId, name: option.name, kind: option.kind }))
    const raw = ctx.params.options.map((option) => ({ optionId: option.optionId, name: option.name, kind: option.kind }))
    const title = ctx.params.toolCall.title || ctx.params.toolCall.toolCallId || 'Permission'
    const turn = current()
    turn?.onEvent?.({ type: 'permission', title, options })
    if (turn?.onPermission && turn.autoApprove === false) {
      const choice = await turn.onPermission({ title, options })
      return permissionDecision(raw, choice)
    }
    return permissionDecision(raw, autoPermission(raw))
  })
}

export function spawnAgent(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv): { child: ChildProcess; stderr: () => string } {
  if (!command) throw new Error('Thiếu lệnh ACP agent.')
  const child = spawn(command, args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] })
  let stderr = ''
  child.stderr?.setEncoding('utf8')
  child.stderr?.on('data', (chunk: string) => {
    stderr += chunk
    if (stderr.length > 8000) stderr = stderr.slice(-8000)
  })
  return { child, stderr: () => stderr }
}

export function agentStreams(child: ChildProcess) {
  const output = Writable.toWeb(child.stdin!) as WritableStream<Uint8Array>
  const input = Readable.toWeb(child.stdout!) as ReadableStream<Uint8Array>
  return acp.ndJsonStream(output, input)
}

export async function runAcpTurn(request: TurnRequest): Promise<TurnResult> {
  const { child, stderr } = spawnAgent(request.command, request.args, request.cwd, request.env)
  const stream = agentStreams(child)
  const slot: { onEvent?: TurnRequest['onEvent']; autoApprove?: boolean; onPermission?: TurnRequest['onPermission'] } = {
    onEvent: request.onEvent,
    autoApprove: request.autoApprove,
    onPermission: request.onPermission,
  }
  const app = wirePermission(acp.client({ name: 'nukeviet-agent-studio' }), () => slot)

  let settled = false
  const kill = () => {
    if (settled) return
    settled = true
    child.kill()
  }
  request.signal?.addEventListener('abort', kill, { once: true })

  try {
    return await app.connectWith(stream, async (ctx) => {
      await ctx.request(acp.methods.agent.initialize, {
        protocolVersion: acp.PROTOCOL_VERSION,
        clientInfo: { name: 'NukeViet Agent Studio', version: '0.2.0' },
        clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
      })
      const session = await ctx.buildSession({ cwd: path.resolve(request.cwd), mcpServers: [] }).start()
      try {
        return await readPromptTurn(session, request.prompt, { onEvent: request.onEvent, signal: request.signal })
      } finally {
        session.dispose()
      }
    })
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    const extra = stderr().trim() ? `\n${stderr().trim().slice(0, 1200)}` : ''
    if (request.signal?.aborted) throw new DOMException('aborted', 'AbortError')
    throw new Error(`${reason}${extra}`)
  } finally {
    settled = true
    if (!child.killed) child.kill()
  }
}

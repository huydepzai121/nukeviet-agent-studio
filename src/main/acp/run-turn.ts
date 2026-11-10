import { spawn } from 'node:child_process'
import { Readable, Writable } from 'node:stream'
import path from 'node:path'
import * as acp from '@agentclientprotocol/sdk'
import type { AgentEvent } from '@shared/types'

export interface TurnRequest {
  command: string
  args: string[]
  cwd: string
  env: NodeJS.ProcessEnv
  prompt: string
  signal?: AbortSignal
  onEvent?: (event: AgentEvent) => void
}

export interface TurnResult {
  stopReason: string
  text: string
  sessionId: string
}

export async function runAcpTurn(request: TurnRequest): Promise<TurnResult> {
  if (!request.command) throw new Error('Thiếu lệnh ACP agent.')
  const child = spawn(request.command, request.args, {
    cwd: request.cwd,
    env: request.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  let stderr = ''
  child.stderr?.setEncoding('utf8')
  child.stderr?.on('data', (chunk: string) => {
    stderr += chunk
    if (stderr.length > 8000) stderr = stderr.slice(-8000)
  })

  const output = Writable.toWeb(child.stdin!) as WritableStream<Uint8Array>
  const input = Readable.toWeb(child.stdout!) as ReadableStream<Uint8Array>
  const stream = acp.ndJsonStream(output, input)
  const app = acp.client({ name: 'nukeviet-agent-studio' }).onRequest(acp.methods.client.session.requestPermission, async (ctx) => {
    const option = ctx.params.options[0]
    if (!option) return { outcome: { outcome: 'cancelled' as const } }
    return { outcome: { outcome: 'selected' as const, optionId: option.optionId } }
  })

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
        clientInfo: { name: 'NukeViet Agent Studio', version: '0.1.0' },
        clientCapabilities: { fs: { readTextFile: false, writeTextFile: false } },
      })
      const session = await ctx.buildSession({ cwd: path.resolve(request.cwd), mcpServers: [] }).start()
      const pending = session.prompt(request.prompt)
      let text = ''
      const seenTools = new Set<string>()
      while (true) {
        const message = await session.nextUpdate()
        if (message.kind === 'stop') {
          request.onEvent?.({ type: 'done', stopReason: message.stopReason })
          break
        }
        const update = message.update
        if (update.sessionUpdate === 'agent_message_chunk' && update.content.type === 'text') {
          text += update.content.text
          request.onEvent?.({ type: 'text', text: update.content.text })
        } else if (update.sessionUpdate === 'tool_call') {
          if (!seenTools.has(update.toolCallId)) seenTools.add(update.toolCallId)
          request.onEvent?.({
            type: 'tool',
            id: update.toolCallId,
            title: update.title,
            status: update.status === 'failed' ? 'failed' : update.status === 'completed' ? 'completed' : 'in_progress',
          })
        } else if (update.sessionUpdate === 'tool_call_update') {
          request.onEvent?.({
            type: 'tool',
            id: update.toolCallId,
            title: update.title || update.toolCallId,
            status: update.status === 'failed' ? 'failed' : update.status === 'completed' ? 'completed' : 'in_progress',
          })
        }
      }
      const response = await pending
      session.dispose()
      return { stopReason: response.stopReason, text, sessionId: session.sessionId }
    })
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    const extra = stderr.trim() ? `\n${stderr.trim().slice(0, 1200)}` : ''
    throw new Error(`${reason}${extra}`)
  } finally {
    settled = true
    if (!child.killed) child.kill()
  }
}

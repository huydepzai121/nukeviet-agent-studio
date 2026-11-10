import { Readable, Writable } from 'node:stream'
import * as acp from '@agentclientprotocol/sdk'
import { chunkText, mockTurn, parseTask } from '../src/shared/mock-script'
import { encodeTurn } from '../src/shared/parse'

const speed = Number(process.env.NVAS_SPEED || '1') || 1

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(new DOMException('aborted', 'AbortError'))
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms / speed)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new DOMException('aborted', 'AbortError'))
      },
      { once: true },
    )
  })
}

const input = Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>
const output = Writable.toWeb(process.stdout) as WritableStream<Uint8Array>
const stream = acp.ndJsonStream(output, input)
const cancelled = new Set<string>()

acp
  .agent({ name: 'nvas-mock' })
  .onRequest(acp.methods.agent.initialize, async () => ({
    protocolVersion: acp.PROTOCOL_VERSION,
    agentInfo: { name: 'nvas-mock', version: '0.1.0' },
    agentCapabilities: { loadSession: false },
  }))
  .onRequest(acp.methods.agent.session.new, async () => ({
    sessionId: crypto.randomUUID(),
  }))
  .onRequest(acp.methods.agent.session.prompt, async (ctx) => {
    const sessionId = ctx.params.sessionId
    cancelled.delete(sessionId)
    const prompt = ctx.params.prompt.map((block) => (block.type === 'text' ? block.text : '')).join('\n')
    const result = mockTurn(parseTask(prompt))
    const turn = encodeTurn(result)
    for (const tool of result.tools) {
      if (ctx.signal.aborted || cancelled.has(sessionId)) return { stopReason: 'cancelled' as const }
      await ctx.client.notify(acp.methods.client.session.update, {
        sessionId,
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: tool.id,
          title: tool.title,
          kind: tool.kind,
          status: 'in_progress',
        },
      })
      await sleep(220, ctx.signal)
      await ctx.client.notify(acp.methods.client.session.update, {
        sessionId,
        update: {
          sessionUpdate: 'tool_call_update',
          toolCallId: tool.id,
          status: 'completed',
        },
      })
    }
    for (const piece of chunkText(turn, 32)) {
      if (ctx.signal.aborted || cancelled.has(sessionId)) return { stopReason: 'cancelled' as const }
      await ctx.client.notify(acp.methods.client.session.update, {
        sessionId,
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: piece },
        },
      })
      await sleep(18, ctx.signal)
    }
    return { stopReason: 'end_turn' as const }
  })
  .onNotification(acp.methods.agent.session.cancel, async (ctx) => {
    cancelled.add(ctx.params.sessionId)
  })
  .connect(stream)

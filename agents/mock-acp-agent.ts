import { Readable, Writable } from 'node:stream'
import * as acp from '@agentclientprotocol/sdk'
import { chunkText, mockTurn, parseTask } from '../src/shared/mock-script'
import { encodeTurn } from '../src/shared/parse'
import { applyBlueprint } from '../src/main/write-blueprint'

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
    const task = parseTask(prompt)
    if (task.kind === 'node' && task.version === '5.x') {
      try {
        applyBlueprint(process.cwd(), {
          nodeId: task.nodeId,
          attempt: task.attempt,
          version: task.version,
          module: task.module,
          title: task.title,
        })
      } catch {
        /* the turn still reports status; a write error must not kill the protocol */
      }
    }
    const result = mockTurn(task)
    const turn = encodeTurn(result)
    if (task.kind === 'chat') {
      const vi = task.lang !== 'en'
      await ctx.client.notify(acp.methods.client.session.update, {
        sessionId,
        update: {
          sessionUpdate: 'plan',
          entries: [
            { content: vi ? 'Đọc bố cục dự án' : 'Read the project layout', priority: 'high', status: 'in_progress' },
            { content: vi ? 'Trả lời theo đúng phiên bản NukeViet' : 'Answer for this NukeViet version', priority: 'medium', status: 'pending' },
          ],
        },
      })
      const decision = await ctx.client.request(acp.methods.client.session.requestPermission, {
        sessionId,
        toolCall: {
          toolCallId: 'perm-read',
          title: vi ? 'Đọc version.php' : 'Read version.php',
          kind: 'read',
          status: 'pending',
        },
        options: [
          { optionId: 'allow', name: vi ? 'Cho phép một lần' : 'Allow once', kind: 'allow_once' },
          { optionId: 'reject', name: vi ? 'Từ chối' : 'Reject', kind: 'reject_once' },
        ],
      })
      const allowed = decision.outcome.outcome === 'selected' && decision.outcome.optionId !== 'reject'
      await ctx.client.notify(acp.methods.client.session.update, {
        sessionId,
        update: {
          sessionUpdate: 'plan',
          entries: [
            {
              content: vi ? 'Đọc bố cục dự án' : 'Read the project layout',
              priority: 'high',
              status: allowed ? 'completed' : 'completed',
            },
            {
              content: vi ? 'Trả lời theo đúng phiên bản NukeViet' : 'Answer for this NukeViet version',
              priority: 'medium',
              status: 'in_progress',
            },
          ],
        },
      })
    }
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

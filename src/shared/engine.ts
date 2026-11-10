import { parseAgentResult } from './parse'
import { buildPrompt, specFor } from './prompts'
import { isAbortError, sleep } from './timing'
import type { AgentEvent, Lang, NodeRuntime, Project, RunRecord, TranscriptItem } from './types'
import { EVAL_IDS, LINEAR_STEPS, MAX_ATTEMPTS, nodeDef } from './workflow'

export interface EngineHost {
  runAgent(
    input: { requestId: string; prompt: string; cwd: string; agentId: string; model: string },
    onEvent: (event: AgentEvent) => void,
    signal: AbortSignal,
  ): Promise<{ stopReason: string; text: string }>
}

export interface EngineHooks {
  onNode: (nodeId: string, patch: Partial<NodeRuntime>) => void
  onRun: (patch: Partial<RunRecord>) => void
  onChat: (text: string, meta?: { toolCalls?: number; durationMs?: number; stopped?: boolean }) => Promise<void>
}

export async function executeRun(options: {
  run: RunRecord
  project: Project
  lang: Lang
  host: EngineHost
  signal: AbortSignal
  hooks: EngineHooks
}): Promise<RunRecord['status']> {
  const { run, project, lang, host, signal, hooks } = options
  hooks.onRun({ status: 'running', live: true, attention: false })

  try {
    for (const nodeId of LINEAR_STEPS) {
      const outcome = await runNode(nodeId, { run, project, lang, host, signal, hooks })
      if (outcome === 'aborted') return finish(hooks, 'aborted', true)
      if (outcome === 'failed') return finish(hooks, 'failed', true)
      if (nodeId === 'gate') {
        const branch = outcome === 'review' || outcome === 'fix' ? outcome : 'review'
        hooks.onRun({ branch, evals: Object.fromEntries(EVAL_IDS.map((id) => [id, 'pass'])) })
        const skipped = branch === 'review' ? 'fix' : 'review'
        hooks.onNode(skipped, { status: 'skipped', attempt: 0, finishedAt: Date.now() })
        const taken = await runNode(branch, { run, project, lang, host, signal, hooks })
        if (taken === 'aborted') return finish(hooks, 'aborted', true)
        if (taken === 'failed') return finish(hooks, 'failed', true)
      }
    }
    return finish(hooks, 'done', false)
  } catch (error) {
    if (isAbortError(error) || signal.aborted) return finish(hooks, 'aborted', true)
    throw error
  }
}

async function runNode(
  nodeId: string,
  ctx: {
    run: RunRecord
    project: Project
    lang: Lang
    host: EngineHost
    signal: AbortSignal
    hooks: EngineHooks
  },
): Promise<'ok' | 'failed' | 'aborted' | 'review' | 'fix'> {
  const spec = specFor(nodeId, ctx.project.version, ctx.project.module, ctx.project.name)
  ctx.hooks.onNode(nodeId, { spec, status: 'pending' })
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    if (ctx.signal.aborted) {
      ctx.hooks.onNode(nodeId, { status: 'aborted', attempt, finishedAt: Date.now() })
      return 'aborted'
    }
    const started = Date.now()
    ctx.hooks.onNode(nodeId, { status: 'running', attempt, startedAt: started, output: '', logs: [], transcript: [] })
    const prompt = buildPrompt({
      kind: 'node',
      nodeId,
      attempt,
      project: ctx.project,
      lang: ctx.lang,
      spec,
    })
    let text = ''
    let tools = 0
    const transcript: TranscriptItem[] = [{ id: `${nodeId}-u-${attempt}`, kind: 'user', text: spec, at: started }]
    try {
      const result = await ctx.host.runAgent(
        {
          requestId: `${ctx.run.id}:${nodeId}:${attempt}`,
          prompt,
          cwd: ctx.project.path,
          agentId: ctx.run.agentId,
          model: ctx.run.model,
        },
        (event) => {
          if (event.type === 'text') {
            text += event.text
            const parsed = parseAgentResult(text)
            ctx.hooks.onNode(nodeId, { output: parsed.visible, logs: parsed.logs.map((line, index) => ({ id: `${nodeId}-l-${index}`, at: Date.now(), ...line })) })
          } else if (event.type === 'tool') {
            if (event.status === 'in_progress') tools += 1
            const existing = transcript.find((item) => item.kind === 'tool' && item.id === event.id)
            if (existing) {
              existing.toolStatus = event.status
              if (event.title) existing.text = event.title
            } else {
              transcript.push({ id: event.id, kind: 'tool', text: event.title, toolStatus: event.status, at: Date.now() })
            }
            ctx.hooks.onNode(nodeId, { transcript: [...transcript] })
          }
        },
        ctx.signal,
      )
      text = result.text || text
      const parsed = parseAgentResult(text)
      transcript.push({ id: `${nodeId}-a-${attempt}`, kind: 'assistant', text: parsed.visible, at: Date.now() })
      const failed = parsed.status === 'failed'
      ctx.hooks.onNode(nodeId, {
        status: failed ? 'failed' : 'done',
        attempt,
        output: parsed.visible,
        transcript: [...transcript],
        logs: parsed.logs.map((line, index) => ({ id: `${nodeId}-l-${index}`, at: Date.now(), ...line })),
        finishedAt: Date.now(),
      })
      await ctx.hooks.onChat(parsed.summary, { toolCalls: tools, durationMs: Date.now() - started })
      if (!failed) return nodeId === 'gate' ? parsed.branch ?? 'review' : 'ok'
      if (attempt === MAX_ATTEMPTS) return 'failed'
      await sleep(1100, ctx.signal)
    } catch (error) {
      if (isAbortError(error) || ctx.signal.aborted) {
        ctx.hooks.onNode(nodeId, { status: 'aborted', attempt, finishedAt: Date.now(), transcript: [...transcript] })
        return 'aborted'
      }
      const message = error instanceof Error ? error.message : String(error)
      ctx.hooks.onNode(nodeId, {
        status: 'failed',
        attempt,
        output: message,
        finishedAt: Date.now(),
        logs: [{ id: `${nodeId}-err`, at: Date.now(), level: 'error', message }],
      })
      await ctx.hooks.onChat(message, { durationMs: Date.now() - started })
      return 'failed'
    }
  }
  return 'failed'
}

function finish(hooks: EngineHooks, status: RunRecord['status'], attention: boolean): RunRecord['status'] {
  hooks.onRun({ status, live: false, attention, finishedAt: Date.now() })
  return status
}

export function blankNodes(version: Project['version'], module: string, title: string): NodeRuntime[] {
  return ['analyze', 'theme', 'scaffold', 'backend', 'lang', 'gate', 'review', 'fix'].map((id) => ({
    id,
    status: 'pending' as const,
    attempt: 0,
    output: '',
    spec: specFor(id, version, module, title),
    transcript: [],
    logs: [],
  }))
}

export function agentLabel(id: string): string {
  return nodeDef(id).agent
}

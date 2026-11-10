import path from 'node:path'
import * as acp from '@agentclientprotocol/sdk'
import type { AgentEvent } from '@shared/types'
import { agentStreams, readPromptTurn, spawnAgent, type PermissionAsk, type TurnResult } from './run-turn'

export interface SessionLaunch {
  command: string
  args: string[]
}

export interface SessionPrompt {
  threadId: string
  launch: SessionLaunch
  cwd: string
  env: NodeJS.ProcessEnv
  prompt: string
  signal?: AbortSignal
  onEvent?: (event: AgentEvent) => void
  onPermission?: (request: PermissionAsk) => Promise<string | null>
}

interface Live {
  key: string
  cwd: string
  command: string
  child: ReturnType<typeof spawnAgent>['child']
  session: acp.ActiveSession
  release: () => void
  current: {
    onEvent?: (event: AgentEvent) => void
    onPermission?: (request: PermissionAsk) => Promise<string | null>
    autoApprove: boolean
  } | null
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

export class SessionPool {
  private lives = new Map<string, Live>()
  private chains = new Map<string, Promise<unknown>>()

  prompt(input: SessionPrompt): Promise<TurnResult> {
    const prev = this.chains.get(input.threadId) ?? Promise.resolve()
    const next = prev.catch(() => undefined).then(() => this.run(input))
    this.chains.set(input.threadId, next)
    return next
  }

  async close(threadId: string): Promise<void> {
    const live = this.lives.get(threadId)
    this.lives.delete(threadId)
    if (!live) return
    live.release()
    if (!live.child.killed) live.child.kill()
  }

  async closeAll(): Promise<void> {
    await Promise.all([...this.lives.keys()].map((id) => this.close(id)))
  }

  private async run(input: SessionPrompt): Promise<TurnResult> {
    const key = `${input.launch.command}\u0000${input.launch.args.join('\u0000')}\u0000${input.cwd}`
    let live = this.lives.get(input.threadId)
    if (!live || live.key !== key || live.child.killed || live.child.exitCode !== null) {
      await this.close(input.threadId)
      live = await this.open(input, key)
      this.lives.set(input.threadId, live)
    }
    const onAbort = () => {
      void this.close(input.threadId)
    }
    if (input.signal?.aborted) {
      await this.close(input.threadId)
      throw new DOMException('aborted', 'AbortError')
    }
    input.signal?.addEventListener('abort', onAbort)
    live.current = { onEvent: input.onEvent, onPermission: input.onPermission, autoApprove: false }
    try {
      return await readPromptTurn(live.session, input.prompt, { onEvent: input.onEvent, signal: input.signal })
    } catch (error) {
      await this.close(input.threadId)
      throw error
    } finally {
      input.signal?.removeEventListener('abort', onAbort)
      if (live) live.current = null
    }
  }

  private async open(input: SessionPrompt, key: string): Promise<Live> {
    const { child, stderr } = spawnAgent(input.launch.command, input.launch.args, input.cwd, input.env)
    const stream = agentStreams(child)
    const gate = deferred<Live>()
    let release = () => {}
    const live: Live = {
      key,
      cwd: input.cwd,
      command: input.launch.command,
      child,
      session: null as unknown as acp.ActiveSession,
      release: () => release(),
      current: null,
    }
    const app = acp.client({ name: 'nukeviet-agent-studio' }).onRequest(acp.methods.client.session.requestPermission, async (ctx) => {
      const options = ctx.params.options.map((option) => ({ id: option.optionId, name: option.name, kind: option.kind }))
      const title = ctx.params.toolCall.title || ctx.params.toolCall.toolCallId || 'Permission'
      const current = live.current
      current?.onEvent?.({ type: 'permission', title, options })
      const choice = current?.onPermission ? await current.onPermission({ title, options }) : null
      if (!choice) return { outcome: { outcome: 'cancelled' as const } }
      return { outcome: { outcome: 'selected' as const, optionId: choice } }
    })
    const connected = app.connectWith(stream, async (ctx) => {
      try {
        await ctx.request(acp.methods.agent.initialize, {
          protocolVersion: acp.PROTOCOL_VERSION,
          clientInfo: { name: 'NukeViet Agent Studio', version: '0.2.0' },
          clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
        })
        const session = await ctx.buildSession({ cwd: path.resolve(input.cwd), mcpServers: [] }).start()
        live.session = session
        gate.resolve(live)
        await new Promise<void>((resolve) => {
          release = resolve
        })
        session.dispose()
      } catch (error) {
        gate.reject(error)
        throw error
      }
    })
    connected.catch((error) => gate.reject(error))
    child.on('exit', () => {
      const detail = stderr().trim()
      gate.reject(new Error(detail || 'Agent đã thoát.'))
    })
    try {
      return await gate.promise
    } catch (error) {
      if (!child.killed) child.kill()
      const reason = error instanceof Error ? error.message : String(error)
      const extra = stderr().trim()
      throw new Error(extra && !reason.includes(extra) ? `${reason}\n${extra.slice(0, 800)}` : reason)
    }
  }
}

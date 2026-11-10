import { describe, expect, it } from 'vitest'
import { executeRun, blankNodes } from '../src/shared/engine'
import { encodeMock, mockTurn, parseTask } from '../src/shared/mock-script'
import { encodeTurn, parseAgentResult } from '../src/shared/parse'
import { buildPrompt } from '../src/shared/prompts'
import { providerEnv, redactEnv } from '../src/shared/provider'
import { setRunSpeed } from '../src/shared/timing'
import type { RunRecord } from '../src/shared/types'
import { SEED_PROJECTS } from '../src/shared/defaults'
import { runAcpTurn } from '../src/main/acp/run-turn'
import path from 'node:path'

const project = SEED_PROJECTS[0]

describe('provider env', () => {
  it('passes both gateway pairs and redacts secrets', () => {
    const env = providerEnv({ gateway: 'both', baseUrl: 'https://bedrock.viber.vn/v1/', model: 'claude-sonnet-4-6' }, 'secret-value')
    expect(env.ANTHROPIC_BASE_URL).toBe('https://bedrock.viber.vn/v1')
    expect(env.OPENAI_BASE_URL).toBe('https://bedrock.viber.vn/v1')
    expect(env.ANTHROPIC_AUTH_TOKEN).toBe('secret-value')
    expect(env.OPENAI_API_KEY).toBe('secret-value')
    const redacted = redactEnv(env)
    expect(redacted.find((row) => row.key === 'ANTHROPIC_AUTH_TOKEN')?.value).toBe('••••••••')
    expect(JSON.stringify(redacted)).not.toContain('secret-value')
  })
})

describe('mock workflow', () => {
  it('fails the skeleton once, then takes the review branch', async () => {
    setRunSpeed(80)
    const patches = new Map<string, { status?: string; attempt?: number }>()
    const run: RunRecord = {
      id: 'run-test',
      workflowId: 'nukeviet-module',
      projectId: project.id,
      projectName: project.name,
      module: project.module,
      version: project.version,
      agentId: 'mock',
      agentName: 'Mock ACP',
      model: 'claude-sonnet-4-6',
      status: 'running',
      live: true,
      createdAt: Date.now(),
      nodes: blankNodes(project.version, project.module, project.name),
      evals: {},
      attention: false,
    }
    let branch: string | undefined
    const status = await executeRun({
      run,
      project,
      lang: 'vi',
      signal: new AbortController().signal,
      host: {
        async runAgent(input, onEvent) {
          const task = parseTask(input.prompt)
          expect(task.version).toBe('5.x')
          expect(input.prompt).toContain('src/modules/news')
          expect(input.prompt).not.toContain('secret-value')
          const text = encodeTurn(mockTurn(task))
          onEvent({ type: 'text', text })
          return { stopReason: 'end_turn', text }
        },
      },
      hooks: {
        onNode: (id, patch) => patches.set(id, { ...patches.get(id), ...patch }),
        onRun: (patch) => {
          if (patch.branch) branch = patch.branch
        },
        onChat: async () => {},
      },
    })
    expect(status).toBe('done')
    expect(branch).toBe('review')
    expect(patches.get('scaffold')).toMatchObject({ status: 'done', attempt: 2 })
    expect(patches.get('fix')).toMatchObject({ status: 'skipped' })
    expect(patches.get('review')).toMatchObject({ status: 'done' })
    expect(patches.get('gate')?.status).toBe('done')
  })

  it('parses control lines out of the visible report', () => {
    const parsed = parseAgentResult(encodeMock(parseTask(buildPrompt({ kind: 'node', nodeId: 'gate', attempt: 1, project, lang: 'vi', spec: 'gate' }))))
    expect(parsed.status).toBe('ok')
    expect(parsed.branch).toBe('review')
    expect(parsed.visible).not.toContain('NVAS_STATUS')
    expect(parsed.summary.length).toBeGreaterThan(10)
  })
})

describe('acp mock agent', () => {
  it('speaks ACP over stdio and reports the first scaffold failure', async () => {
    const prompt = buildPrompt({ kind: 'node', nodeId: 'scaffold', attempt: 1, project, lang: 'vi', spec: 'scaffold' })
    const events: string[] = []
    const result = await runAcpTurn({
      command: process.execPath,
      args: [path.resolve('agents/dist/mock-acp-agent.mjs')],
      cwd: process.cwd(),
      env: { ...process.env, NVAS_SPEED: '30' },
      prompt,
      onEvent: (event) => events.push(event.type),
    })
    const parsed = parseAgentResult(result.text)
    expect(result.stopReason).toBe('end_turn')
    expect(parsed.status).toBe('failed')
    expect(parsed.visible).toContain('php -l')
    expect(events).toContain('tool')
    expect(events).toContain('text')
  })
})

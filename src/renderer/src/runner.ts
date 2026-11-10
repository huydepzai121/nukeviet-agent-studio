import i18n from './i18n'
import { executeRun, blankNodes } from '@shared/engine'
import { buildPrompt, versionCard } from '@shared/prompts'
import { knowledgeFor, WORKFLOW_ID, WORKFLOW_NODES } from '@shared/workflow'
import { isAbortError, setRunSpeed, sleep } from '@shared/timing'
import { chunkText } from '@shared/mock-script'
import type { ChatMessage, Lang, RunRecord } from '@shared/types'
import { activeProject, useStudio } from './store'
import { createHost } from './host'
import { uid } from './lib/format'

let controller: AbortController | null = null
let booted = false

const COMMANDS = [
  { id: 'run', slash: '/run' },
  { id: 'stop', slash: '/stop' },
  { id: 'workflow', slash: '/workflow' },
  { id: 'version', slash: '/version' },
  { id: 'project', slash: '/project' },
  { id: 'knowledge', slash: '/knowledge' },
  { id: 'clear', slash: '/clear' },
  { id: 'help', slash: '/help' },
] as const

export function commandList(): { id: string; slash: string; description: string }[] {
  return COMMANDS.map((command) => ({
    ...command,
    description: i18n.t(`commands.${command.id}`),
  }))
}

export function wantsRun(text: string): boolean {
  const value = text.trim()
  if (/^\/run\b/i.test(value)) return true
  if (/^(hãy\s+|vui lòng\s+)?(chạy|bắt đầu|start|run)\b/i.test(value) && /(workflow|demo|module|quy trình)/i.test(value)) return true
  return false
}

export async function submitChat(raw: string): Promise<void> {
  const text = raw.trim()
  if (!text) return
  const state = useStudio.getState()
  if (text.startsWith('/')) {
    state.addMessage(userMessage(text))
    await handleCommand(text)
    return
  }
  state.addMessage(userMessage(text))
  if (wantsRun(text)) {
    await startRun()
    return
  }
  await askAgent(text)
}

export async function startRun(): Promise<void> {
  const state = useStudio.getState()
  if (state.busy) {
    await say(i18n.t('reply.already'))
    return
  }
  const project = activeProject()
  const agent = state.settings.agents.find((item) => item.id === state.agentId) ?? state.settings.agents[0]
  const run: RunRecord = {
    id: `run-${Math.random().toString(36).slice(2, 6)}`,
    workflowId: WORKFLOW_ID,
    projectId: project.id,
    projectName: project.name,
    module: project.module,
    version: project.version,
    agentId: agent.id,
    agentName: agent.name,
    model: state.settings.model,
    status: 'running',
    live: true,
    createdAt: Date.now(),
    nodes: blankNodes(project.version, project.module, project.name),
    evals: { syntax: 'pending', style: 'pending', input: 'pending', sql: 'pending', csrf: 'pending', files: 'pending' },
    attention: false,
  }
  state.upsertRun(run)
  state.set({ openRunId: run.id, activeTab: run.id, centerView: 'graph', followRun: true, selectedNodeId: 'analyze', busy: true, runsTab: 'runs' })
  controller = new AbortController()
  await say(i18n.t('reply.started', { id: run.id, agent: agent.name, model: state.settings.model, version: project.version }))
  const host = createHost()
  try {
    const status = await executeRun({
      run,
      project,
      lang: state.settings.lang,
      host,
      signal: controller.signal,
      hooks: {
        onNode: (nodeId, patch) => {
          const store = useStudio.getState()
          store.patchNode(run.id, nodeId, patch)
          if ((patch.status === 'done' || patch.status === 'failed') && store.followRun) {
            store.set({ selectedNodeId: nodeId, rightTab: 'inspector', inspectorTab: 'output' })
          }
        },
        onRun: (patch) => useStudio.getState().patchRun(run.id, patch),
        onChat: async (text, meta) => {
          await say(text, meta)
        },
      },
    })
    const key = status === 'done' ? 'reply.done' : status === 'failed' ? 'reply.failed' : 'reply.aborted'
    await say(i18n.t(key, { id: run.id }), status === 'aborted' ? { stopped: true } : undefined)
  } catch (error) {
    if (!isAbortError(error)) {
      const message = error instanceof Error ? error.message : String(error)
      useStudio.getState().patchRun(run.id, { status: 'failed', live: false, attention: true, finishedAt: Date.now() })
      await say(message)
    }
  } finally {
    controller = null
    useStudio.getState().set({ busy: false })
  }
}

export function stopActive(): void {
  controller?.abort()
}

async function handleCommand(text: string): Promise<void> {
  const [head, arg] = text.split(/\s+/, 2)
  const command = head.toLowerCase()
  if (command === '/run') return startRun()
  if (command === '/stop') {
    if (!useStudio.getState().busy) {
      await say(i18n.t('reply.idleStop'))
      return
    }
    stopActive()
    return
  }
  if (command === '/clear') {
    useStudio.getState().clearMessages()
    await say(i18n.t('reply.cleared'))
    return
  }
  if (command === '/help') {
    const lines = commandList().map((item) => `- \`${item.slash}\` — ${item.description}`)
    await say(`${i18n.t('reply.help')}\n\n${lines.join('\n')}`)
    return
  }
  if (command === '/workflow') {
    const lines = WORKFLOW_NODES.map((node) => `- **${i18n.t(`nodes.${node.id}`)}** · \`${node.agent}\``)
    await say(lines.join('\n'))
    return
  }
  if (command === '/project') {
    const project = activeProject()
    await say(i18n.t('reply.project', { name: project.name, module: project.module, version: project.version, path: project.path }))
    return
  }
  if (command === '/knowledge') {
    const project = activeProject()
    const files = knowledgeFor('scaffold', project.version)
    await say([versionCard(project.version), '', ...files.map((file) => `- \`${file}\``)].join('\n'))
    return
  }
  if (command === '/version') {
    const next = arg === '4' || arg === '4.x' ? '4.x' : arg === '5' || arg === '5.x' ? '5.x' : null
    if (!next) {
      await say(`${i18n.t('reply.needVersion')}\n\n${versionCard(activeProject().version)}`)
      return
    }
    const project = activeProject()
    useStudio.getState().patchProject(project.id, { version: next })
    await say(i18n.t('reply.switched', { name: project.name, version: next }))
    return
  }
  await say(i18n.t('reply.needVersion'))
}

async function askAgent(text: string): Promise<void> {
  const state = useStudio.getState()
  if (state.busy) {
    await say(i18n.t('reply.already'))
    return
  }
  const project = activeProject()
  const prompt = buildPrompt({ kind: 'chat', attempt: 1, project, lang: state.settings.lang, userText: text })
  state.set({ busy: true })
  controller = new AbortController()
  const id = uid('m')
  state.addMessage({ id, role: 'assistant', text: '', createdAt: Date.now(), pending: true })
  const started = Date.now()
  let tools = 0
  let full = ''
  try {
    const host = createHost()
    const result = await host.runAgent(
      { requestId: id, prompt, cwd: project.path, agentId: state.agentId, model: state.settings.model },
      (event) => {
        if (event.type === 'text') {
          full += event.text
          const visible = strip(full)
          useStudio.getState().patchMessage(id, { text: visible })
        } else if (event.type === 'tool' && event.status === 'in_progress') {
          tools += 1
        }
      },
      controller.signal,
    )
    useStudio.getState().patchMessage(id, {
      text: strip(result.text),
      pending: false,
      durationMs: Date.now() - started,
      toolCalls: tools,
    })
  } catch (error) {
    if (isAbortError(error)) {
      useStudio.getState().patchMessage(id, { pending: false, stopped: true, durationMs: Date.now() - started })
    } else {
      const message = error instanceof Error ? error.message : String(error)
      useStudio.getState().patchMessage(id, { text: message, pending: false })
    }
  } finally {
    controller = null
    useStudio.getState().set({ busy: false })
  }
}

function strip(raw: string): string {
  let text = raw
  const open = text.indexOf('NVAS_SUMMARY_BEGIN')
  if (open >= 0) {
    const close = text.indexOf('NVAS_SUMMARY_END', open)
    text = close === -1 ? text.slice(0, open) : text.slice(0, open) + text.slice(close + 'NVAS_SUMMARY_END'.length)
  }
  return text
    .replace(/^\s*NVAS_LOG\s+\w+\s+.*$/gm, '')
    .replace(/^\s*NVAS_(STATUS|BRANCH|TASK):?.*$/gm, '')
    .trim()
}

async function say(text: string, meta?: { toolCalls?: number; durationMs?: number; stopped?: boolean }): Promise<void> {
  const id = uid('m')
  const started = Date.now()
  useStudio.getState().addMessage({ id, role: 'assistant', text: '', createdAt: started, pending: true })
  let built = ''
  try {
    for (const piece of chunkText(text, 20)) {
      if (controller?.signal.aborted && meta?.stopped !== true) break
      built += piece
      useStudio.getState().patchMessage(id, { text: built })
      await sleep(12)
    }
  } catch {
    /* typing interrupted */
  }
  useStudio.getState().patchMessage(id, {
    text: built || text,
    pending: false,
    toolCalls: meta?.toolCalls,
    durationMs: meta?.durationMs ?? Date.now() - started,
    stopped: meta?.stopped,
  })
}

function userMessage(text: string): ChatMessage {
  return { id: uid('m'), role: 'user', text, createdAt: Date.now() }
}

export function applyQueryFlags(): void {
  if (booted) return
  booted = true
  const params = new URLSearchParams(location.search)
  const speed = Number(params.get('speed') || '1')
  if (speed > 0) setRunSpeed(speed)
  const lang = params.get('lang')
  if (lang === 'en' || lang === 'vi') {
    useStudio.getState().patchSettings({ lang })
    void i18n.changeLanguage(lang)
  }
  if (params.get('focus') === 'settings') useStudio.getState().set({ settingsOpen: true, settingsSection: 'model' })
  if (params.get('focus') === 'runs') useStudio.getState().set({ bottomHeight: 420, runsTab: 'runs', runFilter: 'all' })
  if (params.get('autodemo') === '1') {
    window.setTimeout(() => {
      void startRun()
    }, 350)
  }
}

export function setLanguage(lang: Lang): void {
  useStudio.getState().patchSettings({ lang })
  void i18n.changeLanguage(lang)
  localStorage.setItem('nvas.lang', lang)
  document.documentElement.lang = lang
}

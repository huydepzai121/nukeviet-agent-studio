import i18n from './i18n'
import { executeRun, blankNodes } from '@shared/engine'
import { buildPrompt, versionCard } from '@shared/prompts'
import { knowledgeFor, WORKFLOW_ID, WORKFLOW_NODES } from '@shared/workflow'
import { isAbortError, setRunSpeed, sleep } from '@shared/timing'
import { chunkText } from '@shared/mock-script'
import { makeThread, workspacePath } from '@shared/threads'
import type { AgentEvent, ChatMessage, ChatPart, Lang, RunRecord } from '@shared/types'
import { activeProject, activeThread, useStudio } from './store'
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
  { id: 'module', slash: '/module' },
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

function ensureThread() {
  const state = useStudio.getState()
  if (state.activeThreadId && activeThread()) return activeThread()
  const project = activeProject()
  if (!project) return null
  const thread = makeThread(project.id, state.agentId || 'mock', uid('th'))
  state.addThread(thread)
  return thread
}

export async function submitChat(raw: string): Promise<void> {
  const text = raw.trim()
  if (!text) return
  if (!activeProject()) {
    useStudio.getState().set({ toast: i18n.t('ade.noProject'), cloneOpen: false })
    return
  }
  ensureThread()
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
  if (!project) {
    useStudio.getState().set({ toast: i18n.t('ade.noProject') })
    return
  }
  ensureThread()
  const thread = activeThread()
  const cwdProject = { ...project, path: workspacePath(project.path, thread) }
  const agent = state.settings.agents.find((item) => item.id === state.agentId) ?? state.settings.agents[0]
  const run: RunRecord = {
    id: `run-${Math.random().toString(36).slice(2, 6)}`,
    workflowId: WORKFLOW_ID,
    projectId: cwdProject.id,
    projectName: cwdProject.name,
    module: cwdProject.module,
    version: cwdProject.version,
    agentId: agent.id,
    agentName: agent.name,
    model: state.settings.model,
    status: 'running',
    live: true,
    createdAt: Date.now(),
    nodes: blankNodes(cwdProject.version, cwdProject.module, cwdProject.name),
    evals: { syntax: 'pending', style: 'pending', input: 'pending', sql: 'pending', csrf: 'pending', files: 'pending' },
    attention: false,
  }
  state.upsertRun(run)
  state.set({ openRunId: run.id, activeTab: run.id, centerView: 'graph', followRun: true, selectedNodeId: 'analyze', busy: true, runsTab: 'runs', mode: 'workflow' })
  controller = new AbortController()
  await say(i18n.t('reply.started', { id: run.id, agent: agent.name, model: state.settings.model, version: cwdProject.version }))
  const host = createHost()
  try {
    const status = await executeRun({
      run,
      project: cwdProject,
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
    if (!project) {
      await say(i18n.t('ade.noProject'))
      return
    }
    await say(i18n.t('reply.project', { name: project.name, module: project.module, version: project.version, path: project.path }))
    return
  }
  if (command === '/knowledge') {
    const project = activeProject()
    if (!project) {
      await say(i18n.t('ade.noProject'))
      return
    }
    const files = knowledgeFor('scaffold', project.version)
    await say([versionCard(project.version), '', ...files.map((file) => `- \`${file}\``)].join('\n'))
    return
  }
  if (command === '/module') {
    const project = activeProject()
    if (!project) {
      await say(i18n.t('ade.noProject'))
      return
    }
    const slug = (arg || '').toLowerCase().replace(/[^a-z0-9_]/g, '')
    if (!slug) {
      await say(i18n.t('commands.module'))
      return
    }
    useStudio.getState().patchProject(project.id, { module: slug })
    await say(i18n.t('reply.project', { name: project.name, module: slug, version: project.version, path: project.path }))
    return
  }
  if (command === '/version') {
    const next = arg === '4' || arg === '4.x' ? '4.x' : arg === '5' || arg === '5.x' ? '5.x' : null
    const project = activeProject()
    if (!project) {
      await say(i18n.t('ade.noProject'))
      return
    }
    if (!next) {
      await say(`${i18n.t('reply.needVersion')}\n\n${versionCard(project.version)}`)
      return
    }
    useStudio.getState().patchProject(project.id, { version: next, detected: next })
    await say(i18n.t('reply.switched', { name: project.name, version: next }))
    return
  }
  await say(i18n.t('reply.needVersion'))
}

function foldEvent(parts: ChatPart[], event: AgentEvent, full: { text: string; tools: number }): ChatPart[] {
  const next = parts.map((part) => ({ ...part }))
  if (event.type === 'text') {
    full.text += event.text
    const part = next.find((item) => item.kind === 'text')
    if (part) part.text = (part.text ?? '') + event.text
    else next.push({ id: uid('p'), kind: 'text', text: event.text })
  } else if (event.type === 'thought') {
    const part = next.find((item) => item.kind === 'thought')
    if (part) part.text = (part.text ?? '') + event.text
    else next.push({ id: uid('p'), kind: 'thought', text: event.text })
  } else if (event.type === 'tool') {
    if (event.status === 'in_progress' && !next.some((item) => item.toolId === event.id)) full.tools += 1
    const part = next.find((item) => item.kind === 'tool' && item.toolId === event.id)
    if (part) {
      part.toolStatus = event.status
      if (event.title) part.text = event.title
    } else next.push({ id: event.id, kind: 'tool', toolId: event.id, text: event.title, toolStatus: event.status })
  } else if (event.type === 'plan') {
    const part = next.find((item) => item.kind === 'plan')
    if (part) part.entries = event.entries
    else next.push({ id: uid('plan'), kind: 'plan', entries: event.entries })
  } else if (event.type === 'permission') {
    next.push({ id: uid('perm'), kind: 'permission', title: event.title, options: event.options })
  }
  return next
}

async function askAgent(text: string): Promise<void> {
  const state = useStudio.getState()
  if (state.busy) {
    await say(i18n.t('reply.already'))
    return
  }
  const project = activeProject()
  if (!project) return
  const thread = activeThread()
  const cwd = workspacePath(project.path, thread)
  const prompt = buildPrompt({ kind: 'chat', attempt: 1, project: { ...project, path: cwd }, lang: state.settings.lang, userText: text })
  state.set({ busy: true })
  controller = new AbortController()
  const id = uid('m')
  state.addMessage({ id, role: 'assistant', text: '', createdAt: Date.now(), pending: true, parts: [] })
  const started = Date.now()
  const full = { text: '', tools: 0 }
  let parts: ChatPart[] = []
  try {
    const host = createHost()
    const result = await host.runAgent(
      {
        requestId: id,
        prompt,
        cwd,
        agentId: thread?.agentId || state.agentId,
        model: state.settings.model,
        threadId: thread?.id,
        autoApprove: false,
      },
      (event) => {
        parts = foldEvent(parts, event, full)
        const chosen = new Map(
          (useStudio.getState().messages.find((item) => item.id === id)?.parts ?? [])
            .filter((part) => part.kind === 'permission' && part.selected)
            .map((part) => [part.title, part.selected]),
        )
        parts = parts.map((part) => (part.kind === 'permission' && !part.selected && chosen.get(part.title || '') ? { ...part, selected: chosen.get(part.title || '') } : part))
        useStudio.getState().patchMessage(id, { text: strip(full.text), parts })
      },
      controller.signal,
    )
    const visible = strip(result.text || full.text)
    useStudio.getState().patchMessage(id, {
      text: visible,
      parts,
      pending: false,
      durationMs: Date.now() - started,
      toolCalls: full.tools,
    })
  } catch (error) {
    if (isAbortError(error)) {
      useStudio.getState().patchMessage(id, { pending: false, stopped: true, durationMs: Date.now() - started, parts })
    } else {
      const message = error instanceof Error ? error.message : String(error)
      useStudio.getState().patchMessage(id, { text: message, pending: false, parts })
    }
  } finally {
    controller = null
    useStudio.getState().set({ busy: false })
    const current = activeProject()
    if (current && window.studio && !current.virtual) {
      void window.studio.gitStatus(workspacePath(current.path, activeThread())).then((status) => {
        useStudio.getState().patchProject(current.id, status)
      })
    }
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
  if (params.get('autodemo') === '1' || params.get('sample') === '1') {
    void import('./ade').then(({ openSample }) => {
      openSample()
      if (params.get('autodemo') === '1') {
        window.setTimeout(() => {
          void startRun()
        }, 350)
      }
    })
  }
}

export function setLanguage(lang: Lang): void {
  useStudio.getState().patchSettings({ lang })
  void i18n.changeLanguage(lang)
  localStorage.setItem('nvas.lang', lang)
  document.documentElement.lang = lang
}

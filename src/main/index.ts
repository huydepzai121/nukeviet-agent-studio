import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runAcpTurn, type PermissionAsk } from './acp/run-turn'
import { SessionPool } from './acp/sessions'
import { clearSecret, readSecret, saveSecret, secretStatus } from './secrets'
import { agentById, DEFAULT_SETTINGS } from '@shared/defaults'
import { modelsEndpoint, providerEnv, splitCommand } from '@shared/provider'
import { normalizeSnapshot, type AdeSnapshot } from '@shared/snapshot'
import { branchSlug } from '@shared/threads'
import type { AgentEvent, AgentTask, ProviderTestRequest, Settings } from '@shared/types'
import { createWorktree, gitDiff, gitFileAction, gitStatus, inspectProject, listDir, startClone, type CloneHandle } from './fs-ops'
import { startTerminal, type TerminalSession } from './terminal'

const mainDir = path.dirname(fileURLToPath(import.meta.url))
const aborts = new Map<string, AbortController>()
const permissions = new Map<string, (optionId: string | null) => void>()
const sessions = new SessionPool()
const terminals = new Map<string, TerminalSession>()
let cloneHandle: CloneHandle | null = null

function repoRoot(): string {
  if (app.isPackaged) return process.resourcesPath
  return path.resolve(process.cwd())
}

function stateFile(): string {
  return path.join(app.getPath('userData'), 'nvas-ade.json')
}

function mockAgentCommand(): { command: string; args: string[] } {
  const bundled = app.isPackaged
    ? path.join(process.resourcesPath, 'agents', 'mock-acp-agent.mjs')
    : path.join(repoRoot(), 'agents', 'dist', 'mock-acp-agent.mjs')
  return { command: process.execPath, args: [bundled] }
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    backgroundColor: '#0c0d10',
    title: 'NukeViet Agent Studio',
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(mainDir, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })
  window.on('ready-to-show', () => window.show())
  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
  const speed = process.env.NVAS_SPEED
  if (process.env.ELECTRON_RENDERER_URL) {
    const url = new URL(process.env.ELECTRON_RENDERER_URL)
    if (speed) url.searchParams.set('speed', speed)
    void window.loadURL(url.toString())
  } else {
    const query = speed ? { speed } : undefined
    void window.loadFile(path.join(mainDir, '../renderer/index.html'), query ? { query } : undefined)
  }
}

function resolveLaunch(task: AgentTask, settings: Settings): { command: string; args: string[]; extra: NodeJS.ProcessEnv } {
  const profile = agentById(settings, task.agentId)
  if (profile.builtin || profile.id === 'mock') {
    const mock = mockAgentCommand()
    return { ...mock, extra: { ELECTRON_RUN_AS_NODE: '1', NVAS_SPEED: String(task.speed || 1) } }
  }
  const split = splitCommand(profile.command)
  if (!split.command) throw new Error(`Agent ${profile.name} chưa có lệnh khởi chạy.`)
  return { command: split.command, args: split.args, extra: {} }
}

function forcedPickDir(): string {
  const fromEnv = process.env.NVAS_PICK_DIR?.trim()
  if (fromEnv) return fromEnv
  try {
    const file = '/tmp/nvas-pick-dir'
    if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim()
  } catch {
    /* ignore */
  }
  return ''
}

async function pickFolder(): Promise<string | null> {
  const forced = forcedPickDir()
  if (forced) return path.resolve(forced)
  const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  const result = await dialog.showOpenDialog(window!, { properties: ['openDirectory', 'createDirectory'] })
  if (result.canceled || !result.filePaths[0]) return null
  return result.filePaths[0]
}

app.whenReady().then(() => {
  ipcMain.handle('window:minimize', (event) => BrowserWindow.fromWebContents(event.sender)?.minimize())
  ipcMain.handle('window:maximize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return
    if (window.isMaximized()) window.unmaximize()
    else window.maximize()
  })
  ipcMain.handle('window:close', (event) => BrowserWindow.fromWebContents(event.sender)?.close())
  ipcMain.handle('app:launch', () => ({
    speed: Number(process.env.NVAS_SPEED || '1') || 1,
    platform: process.platform,
  }))

  ipcMain.handle('secret:status', () => secretStatus())
  ipcMain.handle('secret:save', (_event, key: string) => ({ storage: saveSecret(key) }))
  ipcMain.handle('secret:clear', () => {
    clearSecret()
    return { ok: true }
  })

  ipcMain.handle('provider:test', async (_event, request: ProviderTestRequest) => {
    const apiKey = request.apiKey?.trim() || readSecret()
    if (!apiKey) return { ok: false, message: 'Chưa có API key. Demo Mock ACP vẫn chạy được.' }
    const endpoint = modelsEndpoint(request.baseUrl)
    try {
      const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${apiKey}` } })
      if (!response.ok) return { ok: false, message: `${response.status} ${response.statusText} · ${endpoint}` }
      return { ok: true, message: `Kết nối được ${endpoint}` }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { ok: false, message }
    }
  })

  ipcMain.handle('state:load', () => {
    try {
      if (!fs.existsSync(stateFile())) return null
      return normalizeSnapshot(JSON.parse(fs.readFileSync(stateFile(), 'utf8')))
    } catch {
      return null
    }
  })
  ipcMain.handle('state:save', (_event, snapshot: AdeSnapshot) => {
    const file = stateFile()
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const next = JSON.stringify(normalizeSnapshot(snapshot))
    const tmp = `${file}.tmp`
    fs.writeFileSync(tmp, next)
    fs.renameSync(tmp, file)
    return { ok: true }
  })

  ipcMain.handle('dialog:folder', () => pickFolder())
  ipcMain.handle('project:inspect', (_event, folder: string) => inspectProject(folder))
  ipcMain.handle('git:status', (_event, cwd: string) => gitStatus(cwd))
  ipcMain.handle('git:diff', (_event, cwd: string) => gitDiff(cwd))
  ipcMain.handle('git:action', async (_event, cwd: string, file: string, action: 'accept' | 'revert') => {
    await gitFileAction(cwd, file, action)
    return { ok: true }
  })
  ipcMain.handle('fs:list', (_event, cwd: string, rel: string) => listDir(cwd, rel || ''))
  ipcMain.handle('git:worktree', (_event, repo: string, title: string, threadId: string) => {
    const branch = branchSlug(title || 'chat', threadId || 'work')
    const dest = path.join(app.getPath('userData'), 'worktrees', threadId)
    return createWorktree(repo, branch, dest)
  })

  ipcMain.handle('git:clone', async (event, input: { url: string; parentDir: string; shallow?: boolean; branch?: string }) => {
    if (cloneHandle) throw new Error('Đang có một lệnh clone khác.')
    const handle = startClone(input.url, input.parentDir, input.shallow !== false, input.branch || '', (line) => {
      event.sender.send('git:clone-progress', { line })
    })
    cloneHandle = handle
    try {
      const dest = await handle.done
      event.sender.send('git:clone-progress', { line: dest, done: true })
      return { path: dest }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      event.sender.send('git:clone-progress', { line: message, error: message })
      throw error
    } finally {
      if (cloneHandle === handle) cloneHandle = null
    }
  })
  ipcMain.handle('git:clone-cancel', () => {
    cloneHandle?.cancel()
    cloneHandle = null
    return { ok: true }
  })

  ipcMain.handle('terminal:open', (event, cwd: string) => {
    const session = startTerminal(cwd)
    terminals.set(session.id, session)
    session.onData((data) => {
      if (!event.sender.isDestroyed()) event.sender.send('terminal:data', { id: session.id, data })
    })
    return { id: session.id }
  })
  ipcMain.handle('terminal:write', (_event, id: string, data: string) => {
    terminals.get(id)?.write(data)
  })
  ipcMain.handle('terminal:resize', (_event, id: string, cols: number, rows: number) => {
    terminals.get(id)?.resize(cols, rows)
  })
  ipcMain.handle('terminal:close', (_event, id: string) => {
    terminals.get(id)?.kill()
    terminals.delete(id)
  })

  ipcMain.handle('agent:run', async (event, task: AgentTask, settings: Settings = DEFAULT_SETTINGS) => {
    const controller = new AbortController()
    aborts.set(task.requestId, controller)
    const launch = resolveLaunch(task, settings)
    const cwd = fs.existsSync(task.cwd) ? task.cwd : repoRoot()
    const env = { ...process.env, ...providerEnv(settings, readSecret()), ...launch.extra }
    const onEvent = (agentEvent: AgentEvent) => {
      if (!event.sender.isDestroyed()) event.sender.send('agent:event', { requestId: task.requestId, event: agentEvent })
    }
    const onPermission = (request: PermissionAsk) =>
      new Promise<string | null>((resolve) => {
        permissions.set(task.requestId, resolve)
        controller.signal.addEventListener(
          'abort',
          () => {
            permissions.delete(task.requestId)
            resolve(null)
          },
          { once: true },
        )
      })
    try {
      if (task.threadId && task.autoApprove === false) {
        return await sessions.prompt({
          threadId: task.threadId,
          launch,
          cwd,
          env,
          prompt: task.prompt,
          signal: controller.signal,
          onEvent,
          onPermission,
        })
      }
      return await runAcpTurn({
        command: launch.command,
        args: launch.args,
        cwd,
        env,
        prompt: task.prompt,
        signal: controller.signal,
        onEvent,
        autoApprove: task.autoApprove !== false,
      })
    } finally {
      aborts.delete(task.requestId)
      permissions.delete(task.requestId)
    }
  })

  ipcMain.handle('agent:permission', (_event, requestId: string, optionId: string | null) => {
    const resolve = permissions.get(requestId)
    if (!resolve) return { ok: false }
    permissions.delete(requestId)
    resolve(optionId)
    return { ok: true }
  })

  ipcMain.handle('agent:cancel', (_event, requestId: string) => {
    aborts.get(requestId)?.abort()
    aborts.delete(requestId)
    permissions.get(requestId)?.(null)
    permissions.delete(requestId)
    return { ok: true }
  })

  ipcMain.handle('agent:close-session', async (_event, threadId: string) => {
    await sessions.close(threadId)
    return { ok: true }
  })

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  void sessions.closeAll()
  for (const terminal of terminals.values()) terminal.kill()
  cloneHandle?.cancel()
})

import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runAcpTurn } from './acp/run-turn'
import { clearSecret, readSecret, saveSecret, secretStatus } from './secrets'
import { agentById, DEFAULT_SETTINGS } from '@shared/defaults'
import { modelsEndpoint, providerEnv, splitCommand } from '@shared/provider'
import type { AgentTask, ProviderTestRequest, Settings } from '@shared/types'

const mainDir = path.dirname(fileURLToPath(import.meta.url))
const aborts = new Map<string, AbortController>()

function repoRoot(): string {
  if (app.isPackaged) return process.resourcesPath
  return path.resolve(process.cwd())
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
    minWidth: 1180,
    minHeight: 720,
    show: false,
    backgroundColor: '#0b0c0e',
    title: 'NukeViet Agent Studio',
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(mainDir, '../preload/index.js'),
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
  if (process.env.ELECTRON_RENDERER_URL) void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void window.loadFile(path.join(mainDir, '../renderer/index.html'))
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

app.whenReady().then(() => {
  ipcMain.handle('window:minimize', (event) => BrowserWindow.fromWebContents(event.sender)?.minimize())
  ipcMain.handle('window:maximize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return
    if (window.isMaximized()) window.unmaximize()
    else window.maximize()
  })
  ipcMain.handle('window:close', (event) => BrowserWindow.fromWebContents(event.sender)?.close())

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
      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      if (!response.ok) return { ok: false, message: `${response.status} ${response.statusText} · ${endpoint}` }
      return { ok: true, message: `Kết nối được ${endpoint}` }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { ok: false, message }
    }
  })

  ipcMain.handle('agent:run', async (event, task: AgentTask, settings: Settings = DEFAULT_SETTINGS) => {
    const controller = new AbortController()
    aborts.set(task.requestId, controller)
    const launch = resolveLaunch(task, settings)
    const cwd = fs.existsSync(task.cwd) ? task.cwd : repoRoot()
    const env = {
      ...process.env,
      ...providerEnv(settings, readSecret()),
      ...launch.extra,
    }
    try {
      const result = await runAcpTurn({
        command: launch.command,
        args: launch.args,
        cwd,
        env,
        prompt: task.prompt,
        signal: controller.signal,
        onEvent: (agentEvent) => event.sender.send('agent:event', { requestId: task.requestId, event: agentEvent }),
      })
      return result
    } finally {
      aborts.delete(task.requestId)
    }
  })

  ipcMain.handle('agent:cancel', (_event, requestId: string) => {
    aborts.get(requestId)?.abort()
    aborts.delete(requestId)
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

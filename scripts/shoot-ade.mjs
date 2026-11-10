import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const root = path.resolve(import.meta.dirname, '..')
const outDir = '/opt/cursor/artifacts'
const parent = '/tmp/nvas-shots-parent'
const userData = '/tmp/nvas-shot-userdata'
const repo = path.join(parent, 'nukeviet')
fs.mkdirSync(outDir, { recursive: true })
fs.rmSync(userData, { recursive: true, force: true })
fs.rmSync(repo, { recursive: true, force: true })
fs.mkdirSync(parent, { recursive: true })
fs.writeFileSync('/tmp/nvas-pick-dir', parent)

const electron = path.join(root, 'node_modules/electron/dist/electron')
const child = spawn(
  'xvfb-run',
  ['-a', '-s', '-screen 0 1680x1050x24', electron, '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--remote-debugging-port=9222', `--user-data-dir=${userData}`, '.'],
  {
    cwd: root,
    env: { ...process.env, NVAS_PICK_DIR: parent, NVAS_SPEED: '0.28' },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
)
let log = ''
child.stdout.on('data', (chunk) => {
  log += chunk
})
child.stderr.on('data', (chunk) => {
  log += chunk
})

async function waitForPort() {
  const started = Date.now()
  while (Date.now() - started < 30000) {
    try {
      const response = await fetch('http://127.0.0.1:9222/json/version')
      if (response.ok) return
    } catch {
      /* retry */
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  throw new Error(`Electron did not open a debug port.\n${log.slice(-2000)}`)
}

const shots = []
async function shot(page, name) {
  const file = path.join(outDir, name)
  await page.screenshot({ path: file })
  shots.push(file)
  console.log('shot', name)
}

try {
  await waitForPort()
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: { width: 1600, height: 1000 } })
  const pages = await browser.pages()
  const page = pages.find((item) => item.url().startsWith('file:')) ?? pages[0]
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.waitForSelector('[data-ready="true"]', { timeout: 20000 })
  await page.waitForSelector('[data-testid="welcome"]', { timeout: 15000 })
  await new Promise((resolve) => setTimeout(resolve, 400))
  await shot(page, '01-welcome.png')

  await page.click('[data-testid="welcome-clone"]')
  await page.waitForSelector('[data-testid="clone-dialog"]')
  await page.click('[data-testid="clone-dest"]', { clickCount: 3 })
  await page.keyboard.type(parent)
  await new Promise((resolve) => setTimeout(resolve, 250))
  await shot(page, '02-clone-dialog.png')
  await page.click('[data-testid="clone-start"]')
  await page.waitForSelector('[data-testid="project-open"]', { timeout: 180000 })
  await page.waitForSelector('[data-testid="file-tree"]')
  await new Promise((resolve) => setTimeout(resolve, 700))
  await shot(page, '03-project.png')

  await page.click('[data-testid="new-chat"]')
  await page.click('[data-testid="new-chat"]')
  await new Promise((resolve) => setTimeout(resolve, 200))
  async function renameThread(index, title) {
    const renamed = await page.evaluate((rowIndex) => {
      const rows = [...document.querySelectorAll('[data-testid="thread-row"]')]
      const row = rows[rowIndex]
      if (!row) return false
      row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
      return true
    }, index)
    if (!renamed) return
    await page.waitForSelector('[data-testid="thread-rename"]', { timeout: 5000 })
    await page.click('[data-testid="thread-rename"]', { clickCount: 3 })
    await page.keyboard.type(title)
    await page.keyboard.press('Enter')
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
  await renameThread(1, 'Đổi theme admin')
  await renameThread(2, 'Kiểm tra ngôn ngữ')
  await new Promise((resolve) => setTimeout(resolve, 250))
  await shot(page, '04-threads.png')

  const composer = await page.$('[data-testid="composer"]')
  await composer.click()
  await page.keyboard.type('Xem cách viết module sổ liên hệ trên NukeViet 5')
  await page.click('[data-testid="send"]')
  await page.waitForSelector('[data-testid="permission-card"]', { timeout: 20000 })
  await shot(page, '05-chat-permission.png')
  await page.click('[data-testid="perm-allow"]')
  await page.waitForFunction(() => (document.querySelector('[data-testid="assistant-stream"]')?.innerText || '').length > 30, { timeout: 20000 })
  await shot(page, '06-chat-stream.png')
  await page.waitForFunction(() => !document.querySelector('[data-testid="assistant-stream"]'), { timeout: 60000 })

  await page.click('[data-testid="mode-workflow"]')
  await page.waitForSelector('.react-flow__node')
  await new Promise((resolve) => setTimeout(resolve, 500))
  await shot(page, '07-workflow.png')
  await page.click('[data-testid="run-button"]')
  await page.waitForSelector('[data-node-id="theme"][data-node-status="done"]', { timeout: 120000 })
  await new Promise((resolve) => setTimeout(resolve, 400))
  await shot(page, '08-workflow-running.png')
  await page.waitForSelector('[data-node-id="review"][data-node-status="done"]', { timeout: 180000 })
  await page.click('[data-node-id="scaffold"]')
  await new Promise((resolve) => setTimeout(resolve, 400))
  await shot(page, '09-inspector-files.png')

  await page.click('[data-testid="mode-diff"]')
  await page.waitForSelector('[data-testid="diff-file"]', { timeout: 20000 })
  await new Promise((resolve) => setTimeout(resolve, 300))
  await shot(page, '10-diff.png')

  await page.click('[data-testid="mode-terminal"]')
  await page.waitForSelector('.xterm', { timeout: 10000 })
  await new Promise((resolve) => setTimeout(resolve, 600))
  await page.click('.xterm')
  await page.keyboard.type('git status --short | head\n')
  await new Promise((resolve) => setTimeout(resolve, 900))
  await shot(page, '11-terminal.png')

  fs.writeFileSync(path.join(outDir, 'shoot-errors.txt'), errors.filter(Boolean).join('\n') || 'none')
  console.log('app shots', shots.length, 'errors', errors.length)
  await browser.disconnect()
} catch (error) {
  try {
    const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null })
    const pages = await browser.pages()
    const page = pages.find((item) => item.url().startsWith('file:')) ?? pages[0]
    if (page) await page.screenshot({ path: path.join(outDir, '99-failure.png') })
    const text = page ? await page.evaluate(() => document.body.innerText.slice(0, 1500)) : ''
    fs.writeFileSync(path.join(outDir, 'shoot-fail.txt'), `${error}\n\n${text}\n\n${log.slice(-3000)}`)
    await browser.disconnect()
  } catch (inner) {
    fs.writeFileSync(path.join(outDir, 'shoot-fail.txt'), `${error}\n${inner}\n${log.slice(-3000)}`)
  }
  throw error
} finally {
  child.kill('SIGTERM')
}

if (!fs.existsSync(path.join(repo, 'src/modules/contactbook/version.php'))) {
  throw new Error(`contactbook was not written in ${repo}`)
}
if (!fs.existsSync(path.join(repo, 'src/themes/studio/css/custom.css'))) {
  throw new Error('studio theme css missing')
}
console.log('generated module and theme')

import fs from 'node:fs'
import puppeteer from 'puppeteer-core'

const outDir = '/opt/cursor/artifacts'
fs.mkdirSync(outDir, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: '/opt/google/chrome/chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--font-render-hinting=none'],
  defaultViewport: { width: 1600, height: 1000, deviceScaleFactor: 1 },
})

const page = await browser.newPage()
const errors = []
page.on('pageerror', (error) => errors.push(String(error)))
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text())
})

await page.goto('http://127.0.0.1:43123/?autodemo=1', { waitUntil: 'networkidle0' })
await page.waitForSelector('[data-ready="true"]')
await page.evaluate(() => document.fonts.ready)
await page.waitForSelector('[data-node-id="backend"][data-node-status="running"]', { timeout: 70000 })
await page.waitForFunction(() => /php -l|version\.php/.test(document.querySelector('[data-testid="inspector-body"]')?.textContent || ''), { timeout: 15000 })
await new Promise((resolve) => setTimeout(resolve, 400))
await page.screenshot({ path: `${outDir}/01-main-during-run.png` })

await page.evaluate(() => window.dispatchEvent(new CustomEvent('nvas:panels', { detail: { bottom: 440 } })))
await new Promise((resolve) => setTimeout(resolve, 300))
await page.screenshot({ path: `${outDir}/04-runs-panel.png` })

await page.evaluate(() => {
  window.dispatchEvent(new CustomEvent('nvas:panels', { detail: { bottom: 210 } }))
  window.dispatchEvent(new CustomEvent('nvas:select', { detail: 'scaffold' }))
})
await page.waitForFunction(() => /diff|dấu phẩy|version\.php/.test(document.querySelector('[data-testid="inspector-body"]')?.textContent || ''))
await new Promise((resolve) => setTimeout(resolve, 300))
await page.screenshot({ path: `${outDir}/02-inspector-output.png` })

await page.click('button[aria-label="Cài đặt"]')
await page.waitForSelector('[data-testid="settings"] input')
await new Promise((resolve) => setTimeout(resolve, 300))
await page.screenshot({ path: `${outDir}/03-settings-provider.png` })

fs.writeFileSync(`${outDir}/shoot-errors.txt`, errors.join('\n') || 'none')
await browser.close()
console.log('shots ok', errors.length ? errors : 'no page errors')

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { emptySignals, scoreNukeViet, type DetectSignals } from '@shared/detect'
import { assertCloneUrl, parseGitStatus, parseUnifiedDiff, repoNameFromUrl, untrackedPatch } from '@shared/git-text'
import type { DiffFile, DirEntry, GitStatusInfo, ProjectInspect } from '@shared/types'

const SKIP_DIRS = new Set(['.git', 'node_modules', 'vendor', 'dist', 'out', '.cache', 'release'])

function run(command: string, args: string[], cwd?: string): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk
      if (stdout.length > 2_000_000) stdout = stdout.slice(-2_000_000)
    })
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk
      if (stderr.length > 400_000) stderr = stderr.slice(-400_000)
    })
    child.on('error', reject)
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }))
  })
}

export function insideRoot(root: string, target: string): string {
  const base = path.resolve(root)
  const abs = path.resolve(base, target)
  if (abs !== base && !abs.startsWith(base + path.sep)) throw new Error('Đường dẫn nằm ngoài dự án.')
  return abs
}

export async function gitStatus(cwd: string): Promise<GitStatusInfo> {
  if (!fs.existsSync(cwd)) return { branch: '', dirty: false, repo: false }
  const result = await run('git', ['status', '--porcelain=v1', '-b'], cwd)
  if (result.code !== 0) return { branch: '', dirty: false, repo: false }
  return parseGitStatus(result.stdout)
}

export function collectSignals(root: string): DetectSignals {
  const signals = emptySignals()
  const exists = (rel: string) => fs.existsSync(path.join(root, rel))
  signals.srcLayout = exists('src/modules') || exists('src/includes') || exists('src/themes')
  signals.rootLayout = exists('modules') && exists('includes')
  signals.hasVendorVinades = exists('src/includes/vendor/vinades')
  let seen = 0
  let tplReads = 0
  let phpReads = 0
  const stack = [root]
  while (stack.length) {
    const dir = stack.pop()
    if (!dir) break
    let entries: fs.Dirent[] = []
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (seen > 4000) return signals
      const abs = path.join(dir, entry.name)
      const rel = path.relative(root, abs).split(path.sep).join('/')
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue
        if (rel.split('/').length > 6) continue
        stack.push(abs)
        continue
      }
      if (!entry.isFile()) continue
      seen += 1
      if (entry.name === 'admin_vi.php') signals.adminVi += 1
      if (entry.name === 'vi.php' && rel.includes('/language/')) signals.viPhp += 1
      const lower = entry.name.toLowerCase()
      if ((lower.endsWith('.tpl') || lower.endsWith('.php')) && (tplReads < 8 || phpReads < 6)) {
        let snippet = ''
        try {
          const stat = fs.statSync(abs)
          if (stat.size > 400_000) continue
          snippet = fs.readFileSync(abs, 'utf8').slice(0, 4000)
        } catch {
          continue
        }
        if (lower.endsWith('.tpl')) tplReads += 1
        else phpReads += 1
        if (/NVSmarty|\\NukeViet\\Template|\{\$smarty|\{foreach\b/.test(snippet)) signals.smarty += 1
        if (/XTemplate|<!--\s*BEGIN:/.test(snippet)) signals.xtemplate += 1
      }
    }
  }
  return signals
}

export function moduleSlug(folder: string): string {
  const base = path.basename(folder).toLowerCase().replace(/[^a-z0-9_]+/g, '_')
  return base.replace(/^_+|_+$/g, '') || 'module'
}

export async function inspectProject(folder: string): Promise<ProjectInspect> {
  const abs = path.resolve(folder)
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) throw new Error('Thư mục không tồn tại.')
  const detected = scoreNukeViet(collectSignals(abs))
  const version = detected.version === 'unknown' ? '5.x' : detected.version
  const status = await gitStatus(abs)
  return {
    name: path.basename(abs),
    path: abs,
    module: moduleSlug(abs),
    version,
    detected: detected.version,
    notes: detected.notes,
    branch: status.branch,
    dirty: status.dirty,
    repo: status.repo,
  }
}

export async function gitDiff(cwd: string): Promise<DiffFile[]> {
  insideRoot(cwd, '.')
  const tracked = await run('git', ['diff', '--no-ext-diff', '--unified=3', 'HEAD'], cwd)
  const files = tracked.code === 0 ? parseUnifiedDiff(tracked.stdout) : []
  const untracked = await run('git', ['ls-files', '--others', '--exclude-standard'], cwd)
  if (untracked.code !== 0) return files
  for (const rel of untracked.stdout.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 40)) {
    if (files.some((file) => file.path === rel)) continue
    const abs = insideRoot(cwd, rel)
    let body = ''
    try {
      const stat = fs.statSync(abs)
      if (!stat.isFile() || stat.size > 200_000) {
        files.push({ path: rel, additions: 0, deletions: 0, untracked: true, binary: !stat.isFile() || stat.size > 200_000, patch: '' })
        continue
      }
      body = fs.readFileSync(abs, 'utf8')
    } catch {
      continue
    }
    if (body.includes('\u0000')) {
      files.push({ path: rel, additions: 0, deletions: 0, untracked: true, binary: true, patch: '' })
      continue
    }
    files.push(untrackedPatch(rel, body))
  }
  return files
}

export async function gitFileAction(cwd: string, file: string, action: 'accept' | 'revert'): Promise<void> {
  const rel = file.replace(/\\/g, '/')
  if (!rel || rel.startsWith('/') || rel.includes('\0')) throw new Error('File không hợp lệ.')
  insideRoot(cwd, rel)
  if (action === 'accept') {
    const result = await run('git', ['add', '--', rel], cwd)
    if (result.code !== 0) throw new Error(result.stderr.trim() || 'git add thất bại')
    return
  }
  const listed = await run('git', ['ls-files', '--error-unmatch', '--', rel], cwd)
  if (listed.code !== 0) {
    fs.rmSync(insideRoot(cwd, rel), { force: true })
    return
  }
  const result = await run('git', ['restore', '--source=HEAD', '--worktree', '--', rel], cwd)
  if (result.code !== 0) throw new Error(result.stderr.trim() || 'git restore thất bại')
}

export async function listDir(cwd: string, rel = ''): Promise<DirEntry[]> {
  const abs = insideRoot(cwd, rel || '.')
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) return []
  const entries = fs.readdirSync(abs, { withFileTypes: true })
  const rows: DirEntry[] = []
  for (const entry of entries) {
    if (entry.name === '.git') continue
    const child = rel ? `${rel.replace(/\\/g, '/')}/${entry.name}` : entry.name
    rows.push({ name: entry.name, path: child, kind: entry.isDirectory() ? 'dir' : 'file' })
  }
  rows.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  return rows.slice(0, 500)
}

export function createWorktree(repo: string, branch: string, dest: string): Promise<{ path: string; branch: string }> {
  if (!/^nvas\/[A-Za-z0-9._/-]+$/.test(branch)) throw new Error('Tên nhánh không hợp lệ.')
  const target = path.resolve(dest)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  return run('git', ['worktree', 'add', '-b', branch, target], repo).then((result) => {
    if (result.code !== 0) throw new Error((result.stderr || result.stdout).trim() || 'git worktree thất bại')
    return { path: target, branch }
  })
}

export interface CloneHandle {
  done: Promise<string>
  cancel: () => void
  output: string
}

export function startClone(url: string, parentDir: string, shallow: boolean, branch: string, onLine: (line: string) => void): CloneHandle {
  const safeUrl = assertCloneUrl(url)
  const parent = path.resolve(parentDir)
  if (!fs.existsSync(parent) || !fs.statSync(parent).isDirectory()) throw new Error('Thư mục đích không tồn tại.')
  const name = repoNameFromUrl(safeUrl)
  const dest = path.join(parent, name)
  if (fs.existsSync(dest)) throw new Error(`Đã có ${dest}`)
  const args = ['clone', '--progress']
  if (shallow) args.push('--depth', '1')
  const safeBranch = branch.trim()
  if (safeBranch) {
    if (!/^[A-Za-z0-9._/-]+$/.test(safeBranch)) throw new Error('Tên nhánh không hợp lệ.')
    args.push('--branch', safeBranch)
  }
  args.push(safeUrl, dest)
  const child = spawn('git', args, { env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } })
  let output = ''
  const push = (chunk: string) => {
    output += chunk
    if (output.length > 200_000) output = output.slice(-200_000)
    for (const line of chunk.split(/\r|\n/).map((item) => item.trim()).filter(Boolean)) onLine(line)
  }
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', push)
  child.stderr.on('data', push)
  const done = new Promise<string>((resolve, reject) => {
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve(dest)
      else reject(new Error(output.trim().split('\n').slice(-4).join('\n') || `git clone thoát ${code}`))
    })
  })
  return {
    done,
    cancel: () => child.kill('SIGTERM'),
    get output() {
      return output
    },
  }
}

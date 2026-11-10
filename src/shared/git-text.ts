import type { DiffFile, GitStatusInfo } from './types'

export function parseGitStatus(stdout: string): GitStatusInfo {
  const lines = stdout.split(/\r?\n/).filter((line) => line.length > 0)
  if (lines.length === 0) return { branch: '', dirty: false, repo: false }
  const head = lines.find((line) => line.startsWith('## '))
  if (!head) return { branch: '', dirty: lines.length > 0, repo: false }
  let branch = head.slice(3)
  branch = branch.split('...')[0] ?? branch
  if (branch.startsWith('HEAD (no branch)') || branch.startsWith('HEAD')) branch = 'HEAD'
  else branch = branch.split(' ')[0] || 'HEAD'
  const dirty = lines.some((line) => !line.startsWith('##'))
  return { branch, dirty, repo: true }
}

export function parseUnifiedDiff(diff: string): DiffFile[] {
  if (!diff.trim()) return []
  const chunks = diff.split(/^diff --git /m).slice(1)
  return chunks.map((chunk) => {
    const header = chunk.split('\n')[0] ?? ''
    const match = header.match(/b\/(.+)$/)
    const filePath = (match?.[1] ?? 'unknown').replace(/^"(.*)"$/, '$1')
    let additions = 0
    let deletions = 0
    for (const line of chunk.split('\n')) {
      if (line.startsWith('+') && !line.startsWith('+++')) additions += 1
      else if (line.startsWith('-') && !line.startsWith('---')) deletions += 1
    }
    return {
      path: filePath,
      additions,
      deletions,
      untracked: false,
      binary: /Binary files /.test(chunk) || /GIT binary patch/.test(chunk),
      patch: chunk.slice(0, 80_000),
    }
  })
}

export function assertCloneUrl(url: string): string {
  const value = url.trim()
  if (!value) throw new Error('Thiếu URL Git.')
  if (value.length > 500) throw new Error('URL quá dài.')
  if (!/^(https:\/\/|git:\/\/|ssh:\/\/|git@)/.test(value)) throw new Error('Chỉ nhận URL https, git:// hoặc ssh.')
  if (/[\s"'`$;&|<>\\]/.test(value)) throw new Error('URL chứa ký tự không hợp lệ.')
  return value
}

export function repoNameFromUrl(url: string): string {
  const cleaned = url.trim().replace(/\.git$/, '').replace(/\/+$/, '')
  const name = cleaned.split(/[:/]/).pop() || 'repo'
  const safe = name.replace(/[^A-Za-z0-9._-]/g, '')
  return safe || 'repo'
}

export function untrackedPatch(file: string, body: string): DiffFile {
  const lines = body.split('\n').slice(0, 200)
  const patch = [`a/dev/null b/${file}`, `--- /dev/null`, `+++ b/${file}`, ...lines.map((line) => `+${line}`)].join('\n')
  return {
    path: file,
    additions: lines.filter((line) => line.length > 0 || lines.length === 1).length,
    deletions: 0,
    untracked: true,
    binary: false,
    patch,
  }
}

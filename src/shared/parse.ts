export interface ParsedAgentResult {
  status: 'ok' | 'failed'
  branch?: 'review' | 'fix'
  summary: string
  visible: string
  logs: { level: 'info' | 'warn' | 'error'; message: string }[]
}

export function parseAgentResult(raw: string): ParsedAgentResult {
  let summary = ''
  let rest = raw.replace(/\r\n/g, '\n')
  const summaryMatch = rest.match(/NVAS_SUMMARY_BEGIN\n([\s\S]*?)\nNVAS_SUMMARY_END\n?/)
  if (summaryMatch) {
    summary = summaryMatch[1].trim()
    rest = rest.replace(summaryMatch[0], '')
  }

  let status: 'ok' | 'failed' | undefined
  let branch: 'review' | 'fix' | undefined
  const logs: ParsedAgentResult['logs'] = []
  const visible: string[] = []

  for (const line of rest.split('\n')) {
    const statusMatch = line.match(/^\s*NVAS_STATUS:\s*(ok|failed)\s*$/i)
    const branchMatch = line.match(/^\s*NVAS_BRANCH:\s*(review|fix)\s*$/i)
    const logMatch = line.match(/^\s*NVAS_LOG\s+(info|warn|error)\s+(.*)$/i)
    if (statusMatch) status = statusMatch[1].toLowerCase() as 'ok' | 'failed'
    else if (branchMatch) branch = branchMatch[1].toLowerCase() as 'review' | 'fix'
    else if (logMatch) logs.push({ level: logMatch[1].toLowerCase() as 'info' | 'warn' | 'error', message: logMatch[2] })
    else visible.push(line)
  }

  const body = visible.join('\n').trim()
  return {
    status: status ?? 'ok',
    branch,
    summary: summary || firstBlock(body),
    visible: body,
    logs,
  }
}

function firstBlock(markdown: string): string {
  const lines = markdown.split('\n')
  const kept: string[] = []
  for (const line of lines) {
    if (kept.length > 0 && line.trim() === '' && kept.length >= 2) break
    kept.push(line)
    if (kept.join('\n').length > 420) break
  }
  return kept.join('\n').trim()
}

export function encodeTurn(input: {
  summary: string
  text: string
  status: 'ok' | 'failed'
  branch?: 'review' | 'fix'
  logs: { level: 'info' | 'warn' | 'error'; message: string }[]
}): string {
  const parts = [
    'NVAS_SUMMARY_BEGIN',
    input.summary.trim(),
    'NVAS_SUMMARY_END',
    input.text.trim(),
    ...input.logs.map((line) => `NVAS_LOG ${line.level} ${line.message}`),
    `NVAS_STATUS: ${input.status}`,
  ]
  if (input.branch) parts.push(`NVAS_BRANCH: ${input.branch}`)
  return parts.join('\n')
}

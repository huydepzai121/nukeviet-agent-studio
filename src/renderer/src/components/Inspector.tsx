import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { versionCard } from '@shared/prompts'
import { MAX_ATTEMPTS, WORKFLOW_NODES, knowledgeFor } from '@shared/workflow'
import type { RunRecord } from '@shared/types'
import { readPack } from '../lib/pack'
import { useStudio } from '../store'
import { MarkdownView } from './MarkdownView'

export function Inspector({ width }: { width: number }) {
  const { t } = useTranslation()
  const rightTab = useStudio((s) => s.rightTab)
  const set = useStudio((s) => s.set)
  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-line bg-panel" style={{ width }} data-testid="inspector">
      <div className="flex h-11 items-center gap-1 border-b border-line px-2">
        <button type="button" onClick={() => set({ rightTab: 'inspector' })} className={tabClass(rightTab === 'inspector')}>
          {t('inspector.title')}
        </button>
        <button type="button" onClick={() => set({ rightTab: 'workflow' })} className={tabClass(rightTab === 'workflow')}>
          {t('inspector.workflow')}
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">{rightTab === 'inspector' ? <NodeInspector /> : <WorkflowPane />}</div>
    </aside>
  )
}

function NodeInspector() {
  const { t } = useTranslation()
  const tab = useStudio((s) => s.inspectorTab)
  const selected = useStudio((s) => s.selectedNodeId)
  const activeTab = useStudio((s) => s.activeTab)
  const runs = useStudio((s) => s.runs)
  const project = useStudio((s) => s.projects.find((item) => item.id === s.activeProjectId) ?? s.projects[0])
  const set = useStudio((s) => s.set)
  const run = activeTab === 'workflow' ? undefined : runs.find((item) => item.id === activeTab)
  const node = run?.nodes.find((item) => item.id === selected)
  if (!selected) {
    return (
      <div className="grid h-full place-items-center px-8 text-center">
        <div>
          <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-xl border border-line text-faint">⌘</div>
          <div className="text-[13px] font-medium">{t('inspector.emptyTitle')}</div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-mute">{t('inspector.empty')}</p>
        </div>
      </div>
    )
  }
  const spec = node?.spec || ''
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line px-3 py-2.5">
        <div className="text-[13px] font-medium">{t(`nodes.${selected}`)}</div>
        <div className="font-mono text-[11px] text-faint">{WORKFLOW_NODES.find((item) => item.id === selected)?.agent}</div>
      </div>
      <div className="flex gap-1 border-b border-line px-2 py-1.5">
        {(['spec', 'output', 'transcript', 'logs'] as const).map((item) => (
          <button key={item} type="button" onClick={() => set({ inspectorTab: item })} className={tabClass(tab === item)}>
            {t(`inspector.${item}`)}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-3 py-3" data-testid="inspector-body">
        {tab === 'spec' ? <MarkdownView text={spec || t('inspector.noOutput')} /> : null}
        {tab === 'output' ? <MarkdownView text={node?.output || t('inspector.noOutput')} /> : null}
        {tab === 'transcript' ? <Transcript node={node} /> : null}
        {tab === 'logs' ? <Logs node={node} /> : null}
        {tab === 'spec' ? (
          <div className="mt-4 border-t border-line pt-3">
            <div className="mb-1.5 text-[11px] tracking-wide text-faint uppercase">{t('inspector.knowledge')}</div>
            <ul className="space-y-1 font-mono text-[11px] text-mute">
              {knowledgeFor(selected, project.version).map((file) => (
                <li key={file}>{file}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function Transcript({ node }: { node?: RunRecord['nodes'][number] }) {
  const { t } = useTranslation()
  if (!node?.transcript.length) return <p className="text-[12px] text-mute">{t('inspector.noTranscript')}</p>
  return (
    <div className="space-y-3">
      {node.transcript.map((item) => (
        <article key={item.id} className="rounded-lg border border-line bg-black/20 px-2.5 py-2">
          <div className="mb-1 font-mono text-[10.5px] text-faint">
            {item.kind}
            {item.toolStatus ? ` · ${item.toolStatus}` : ''}
          </div>
          <MarkdownView text={item.text} />
        </article>
      ))}
    </div>
  )
}

function Logs({ node }: { node?: RunRecord['nodes'][number] }) {
  const { t } = useTranslation()
  if (!node?.logs.length) return <p className="text-[12px] text-mute">{t('inspector.noLogs')}</p>
  return (
    <div className="space-y-1 font-mono text-[11.5px]">
      {node.logs.map((line) => (
        <div key={line.id} className={line.level === 'error' ? 'text-bad' : line.level === 'warn' ? 'text-warn' : 'text-mute'}>
          <span className="text-faint">{line.level}</span> {line.message}
        </div>
      ))}
    </div>
  )
}

function WorkflowPane() {
  const { t } = useTranslation()
  const project = useStudio((s) => s.projects.find((item) => item.id === s.activeProjectId) ?? s.projects[0])
  const [doc, setDoc] = useState<string | null>(null)
  const [body, setBody] = useState('')
  const files = knowledgeFor('analyze', project.version)
  useEffect(() => {
    if (!doc) return
    let cancelled = false
    void readPack(doc).then((text) => {
      if (!cancelled) setBody(text ?? t('inspector.noOutput'))
    })
    return () => {
      cancelled = true
    }
  }, [doc, t])
  return (
    <div className="space-y-4 px-3 py-3">
      <div>
        <div className="text-[12px] text-faint">{t('inspector.versionCard')}</div>
        <pre className="mt-2 overflow-auto rounded-xl border border-line bg-black/25 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-mute">{versionCard(project.version)}</pre>
      </div>
      <p className="text-[12px] text-mute">{t('inspector.retry', { n: MAX_ATTEMPTS })}</p>
      <DiffTable />
      <div>
        <div className="mb-1.5 text-[11px] tracking-wide text-faint uppercase">{t('inspector.pack')}</div>
        <div className="space-y-1">
          {files.map((file) => (
            <button key={file} type="button" onClick={() => setDoc(file)} className="block w-full truncate rounded-md px-2 py-1 text-left font-mono text-[11px] text-mute hover:bg-white/5 hover:text-ink">
              {file}
            </button>
          ))}
        </div>
        {doc ? (
          <pre className="mt-3 max-h-80 overflow-auto rounded-xl border border-line bg-black/30 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-[#d5d6de]">{body.slice(0, 6000)}</pre>
        ) : null}
      </div>
    </div>
  )
}

function DiffTable() {
  const { t } = useTranslation()
  const rows = [
    ['code', 'v4code', 'v5code'],
    ['php', 'v4php', 'v5php'],
    ['style', 'v4style', 'v5style'],
    ['template', 'v4tpl', 'v5tpl'],
    ['lang', 'v4lang', 'v5lang'],
    ['block', 'v4block', 'v5block'],
  ] as const
  return (
    <table className="w-full border-collapse text-[12px]">
      <thead>
        <tr className="text-left text-faint">
          <th className="border-b border-line py-1.5 font-medium">{t('diff.title')}</th>
          <th className="border-b border-line py-1.5 font-medium">4.x</th>
          <th className="border-b border-line py-1.5 font-medium">5.x</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, a, b]) => (
          <tr key={label}>
            <td className="border-b border-line/80 py-1.5 pr-2 text-mute">{t(`diff.${label}`)}</td>
            <td className="border-b border-line/80 py-1.5 pr-2">{t(`diff.${a}`)}</td>
            <td className="border-b border-line/80 py-1.5">{t(`diff.${b}`)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function tabClass(active: boolean): string {
  return `rounded-md px-2 py-1 text-[12px] ${active ? 'bg-white/8 text-ink' : 'text-mute hover:text-ink'}`
}

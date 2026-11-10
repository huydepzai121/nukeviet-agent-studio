import { Play } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { EVAL_IDS } from '@shared/workflow'
import type { RunRecord } from '@shared/types'
import { startRun } from '../runner'
import { useStudio, type RunFilter } from '../store'
import { formatClock, relativeTime } from '../lib/format'

const FILTERS: RunFilter[] = ['active', 'attention', 'live', 'finished', 'all']

export function RunsPanel({ height }: { height: number }) {
  const { t, i18n } = useTranslation()
  const runs = useStudio((s) => s.runs)
  const tab = useStudio((s) => s.runsTab)
  const filter = useStudio((s) => s.runFilter)
  const query = useStudio((s) => s.runQuery)
  const set = useStudio((s) => s.set)
  const counts = useMemo(() => countRuns(runs), [runs])
  const visible = runs.filter((run) => matchFilter(run, filter)).filter((run) => {
    const hay = `${run.id} ${run.projectName} ${run.module} ${run.agentName}`.toLowerCase()
    return hay.includes(query.trim().toLowerCase())
  })
  const lang = i18n.language === 'en' ? 'en' : 'vi'

  return (
    <section className="flex min-h-0 flex-col border-t border-line bg-panel" style={{ height }} data-testid="runs">
      <div className="flex h-9 items-center gap-1 border-b border-line px-2">
        <button type="button" onClick={() => set({ runsTab: 'runs' })} className={tabClass(tab === 'runs')}>
          {t('runs.title')}
        </button>
        <button type="button" onClick={() => set({ runsTab: 'evals' })} className={tabClass(tab === 'evals')}>
          {t('runs.evals')}
        </button>
      </div>
      {tab === 'runs' ? (
        <>
          <div className="flex items-center gap-1.5 px-2.5 py-2">
            {FILTERS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => set({ runFilter: item })}
                className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] ${filter === item ? 'bg-white/8 text-ink' : 'text-mute hover:text-ink'}`}
              >
                {t(`runs.${item === 'attention' ? 'attention' : item}`)}
                <span className="font-mono text-[10.5px] text-faint">{counts[item]}</span>
              </button>
            ))}
            <div className="flex-1" />
            <input
              value={query}
              onChange={(event) => set({ runQuery: event.target.value })}
              placeholder={t('runs.search')}
              className="h-7 w-48 rounded-md border border-line bg-black/20 px-2 text-[12px] outline-none placeholder:text-faint focus:border-white/20"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-auto px-2 pb-2">
            {visible.length === 0 ? (
              <div className="grid h-full place-items-center text-center">
                <div>
                  <button
                    type="button"
                    onClick={() => void startRun()}
                    className="mx-auto grid h-10 w-10 place-items-center rounded-full border border-line text-mute hover:text-ink"
                    aria-label={t('runs.play')}
                  >
                    <Play size={16} />
                  </button>
                  <div className="mt-3 text-[13px]">{t('runs.nothing')}</div>
                  <p className="mt-1 text-[12px] text-faint">{t('runs.nothingHint')}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {visible.map((run) => (
                  <button
                    key={run.id}
                    type="button"
                    onClick={() => set({ openRunId: run.id, activeTab: run.id, centerView: 'graph', selectedNodeId: run.nodes.find((node) => node.status === 'running')?.id ?? run.nodes[0]?.id ?? null })}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-white/4"
                  >
                    <Dot status={run.status} live={run.live} />
                    <span className="w-16 font-mono text-[12px] text-ink">{run.id}</span>
                    <span className="w-28 truncate text-[12px]">{run.projectName}</span>
                    <span className="font-mono text-[11px] text-faint">
                      {run.module} · {run.version}
                    </span>
                    <span className="text-[12px] text-mute">{run.agentName}</span>
                    <span className="ml-auto font-mono text-[11px] text-faint">{formatClock((run.finishedAt ?? Date.now()) - run.createdAt)}</span>
                    <span className="w-24 text-right text-[11px] text-mute">{t(`runState.${run.status}`)}</span>
                    <span className="w-24 text-right text-[11px] text-faint">{relativeTime(run.createdAt, lang)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <EvalList />
      )}
    </section>
  )
}

function EvalList() {
  const { t } = useTranslation()
  const runs = useStudio((s) => s.runs)
  const latest = runs.find((run) => run.status === 'done') ?? runs[0]
  if (!latest) return <p className="px-4 py-6 text-[12px] text-mute">{t('evals.empty')}</p>
  return (
    <div className="min-h-0 flex-1 overflow-auto px-3 py-2">
      <div className="mb-2 font-mono text-[11px] text-faint">{latest.id}</div>
      <div className="space-y-1">
        {EVAL_IDS.map((id) => {
          const state = latest.evals[id] ?? 'pending'
          return (
            <div key={id} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-white/3">
              <span className="text-[12.5px]">{t(`evals.${id}`)}</span>
              <span className={state === 'pass' ? 'text-[12px] text-ok' : state === 'fail' ? 'text-[12px] text-bad' : 'text-[12px] text-faint'}>{t(`evals.${state}`)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Dot({ status, live }: { status: RunRecord['status']; live: boolean }) {
  const color = status === 'done' ? 'bg-ok' : status === 'failed' || status === 'aborted' ? 'bg-bad' : 'bg-warn'
  return <span className={`h-1.5 w-1.5 rounded-full ${color} ${live ? 'live-dot' : ''}`} />
}

function countRuns(runs: RunRecord[]): Record<RunFilter, number> {
  return {
    active: runs.filter((run) => run.status === 'running').length,
    attention: runs.filter((run) => run.attention).length,
    live: runs.filter((run) => run.live).length,
    finished: runs.filter((run) => run.status === 'done').length,
    all: runs.length,
  }
}

function matchFilter(run: RunRecord, filter: RunFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'active') return run.status === 'running'
  if (filter === 'attention') return run.attention
  if (filter === 'live') return run.live
  return run.status === 'done'
}

function tabClass(active: boolean): string {
  return `rounded-md px-2 py-1 text-[12px] ${active ? 'text-ink' : 'text-mute hover:text-ink'}`
}

import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useReactFlow, ReactFlowProvider } from '@xyflow/react'
import { WORKFLOW_EDGES, WORKFLOW_NODES } from '@shared/workflow'
import type { RunRecord } from '@shared/types'
import { startRun, stopActive } from '../runner'
import { useStudio } from '../store'
import { MarkdownView } from './MarkdownView'
import { nodeTypes, type FlowData } from './FlowNodes'
import { Pill } from './ui'

export function CenterStage() {
  return (
    <ReactFlowProvider>
      <Stage />
    </ReactFlowProvider>
  )
}

function Stage() {
  const { t } = useTranslation()
  const runs = useStudio((s) => s.runs)
  const activeTab = useStudio((s) => s.activeTab)
  const openRunId = useStudio((s) => s.openRunId)
  const centerView = useStudio((s) => s.centerView)
  const selectedNodeId = useStudio((s) => s.selectedNodeId)
  const followRun = useStudio((s) => s.followRun)
  const busy = useStudio((s) => s.busy)
  const set = useStudio((s) => s.set)
  const shown = activeTab === 'workflow' ? undefined : runs.find((item) => item.id === activeTab)
  const focusId = shown?.nodes.find((node) => node.status === 'running')?.id

  return (
    <section className="flex h-full min-h-0 flex-col bg-[#0c0d10]" data-testid="canvas">
      <div className="flex h-10 items-end gap-1 border-b border-line px-2">
        <Tab active={activeTab === 'workflow'} onClick={() => set({ activeTab: 'workflow' })}>
          {t('center.workflow')} · Module NukeViet
        </Tab>
        {openRunId ? (
          <Tab
            active={activeTab === openRunId}
            onClick={() => set({ activeTab: openRunId })}
            onClose={() => set({ activeTab: 'workflow', openRunId: activeTab === openRunId ? null : openRunId })}
          >
            {openRunId}
          </Tab>
        ) : null}
      </div>
      <div className="flex h-11 items-center gap-2 border-b border-line px-3">
        <span className="font-mono text-[12px] text-ink">{shown ? shown.id : 'module-nukeviet'}</span>
        <span className="rounded-md bg-white/6 px-1.5 py-0.5 font-mono text-[10px] text-mute">v1</span>
        <span className="truncate font-mono text-[11px] text-faint">{shown ? `${shown.module} · ${shown.version}` : 'templates/module'}</span>
        <Pill tone={toneOf(shown?.status)}>{shown ? t(`runState.${shown.status}`) : t('status.idle')}</Pill>
        <div className="flex-1" />
        {busy && shown?.status === 'running' ? (
          <button type="button" onClick={() => stopActive()} className="rounded-md px-2 py-1 text-[12px] text-bad hover:bg-bad/10">
            {t('chat.stop')}
          </button>
        ) : (
          <button
            type="button"
            data-testid="run-button"
            onClick={() => void startRun()}
            className="rounded-md bg-white px-2.5 py-1 text-[12px] font-medium text-canvas hover:bg-white/90"
          >
            {t('center.run')}
          </button>
        )}
      </div>
      <div className="flex h-9 items-center gap-1 px-3 text-[12px]">
        {(['graph', 'review', 'messages'] as const).map((view) => (
          <button
            key={view}
            type="button"
            onClick={() => set({ centerView: view })}
            className={`rounded-md px-2 py-1 ${centerView === view ? 'bg-white/8 text-ink' : 'text-mute hover:text-ink'}`}
          >
            {t(`center.${view}`)}
            {view === 'messages' ? ` (${messageCount(shown)})` : ''}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        {centerView === 'graph' ? (
          <Graph shown={activeTab === 'workflow' ? undefined : shown} selectedNodeId={selectedNodeId} focusId={followRun ? focusId : undefined} onSelect={(id) => set({ selectedNodeId: id, followRun: false, rightTab: 'inspector' })} />
        ) : centerView === 'review' ? (
          <div className="h-full overflow-auto px-6 py-4">
            {shown ? <Report run={shown} /> : <p className="text-mute">{t('center.noReview')}</p>}
          </div>
        ) : (
          <div className="h-full overflow-auto px-6 py-4">
            {shown && messageCount(shown) > 0 ? <Transcripts run={shown} /> : <p className="text-mute">{t('center.noMessages')}</p>}
          </div>
        )}
      </div>
    </section>
  )
}

function Graph({
  shown,
  selectedNodeId,
  focusId,
  onSelect,
}: {
  shown?: RunRecord
  selectedNodeId: string | null
  focusId?: string
  onSelect: (id: string) => void
}) {
  const nodes = useMemo<Node<FlowData>[]>(() => {
    return WORKFLOW_NODES.map((node) => {
      const runtime = shown?.nodes.find((item) => item.id === node.id)
      return {
        id: node.id,
        type: node.kind,
        position: { x: node.x, y: node.y },
        selected: node.id === selectedNodeId,
        data: {
          nodeId: node.id,
          agent: node.agent,
          kind: node.kind,
          status: runtime?.status ?? 'pending',
          attempt: runtime?.attempt ?? 0,
        },
      }
    })
  }, [shown, selectedNodeId])

  const edges = useMemo<Edge[]>(() => {
    return WORKFLOW_EDGES.map((edge) => {
      const target = shown?.nodes.find((node) => node.id === edge.target)
      const source = shown?.nodes.find((node) => node.id === edge.source)
      const taken = !edge.when || shown?.branch === edge.when || (!shown?.branch && target?.status === 'done')
      const skipped = edge.when && shown?.branch && shown.branch !== edge.when
      const running = target?.status === 'running'
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        animated: Boolean(running && source?.status === 'done'),
        style: {
          stroke: skipped ? '#3a3c44' : target?.status === 'failed' ? '#f07178' : target?.status === 'done' && taken ? '#3ecf8e' : running ? '#e6b450' : '#4a4d57',
          strokeWidth: 1.4,
          strokeDasharray: skipped ? '4 4' : undefined,
        },
      }
    })
  }, [shown])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      minZoom={0.45}
      maxZoom={1.4}
      proOptions={{ hideAttribution: false }}
      onNodeClick={(_, node) => onSelect(node.id)}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable
    >
      <Background variant={BackgroundVariant.Dots} gap={18} size={1.1} color="#2a2c33" />
      <Controls showInteractive={false} position="bottom-left" />
      <FitOnce tabKey={shown?.id ?? 'workflow'} skip={Boolean(focusId)} />
      <Focus focusId={focusId} />
    </ReactFlow>
  )
}

function FitOnce({ tabKey, skip }: { tabKey: string; skip: boolean }) {
  const rf = useReactFlow()
  useEffect(() => {
    if (skip) return
    const timer = window.setTimeout(() => {
      void rf.fitView({ padding: 0.2, maxZoom: 1, duration: 220 })
    }, 40)
    return () => window.clearTimeout(timer)
  }, [tabKey, skip, rf])
  return null
}

function Focus({ focusId }: { focusId?: string }) {
  const rf = useReactFlow()
  useEffect(() => {
    if (!focusId) return
    const node = rf.getNode(focusId)
    if (!node) return
    void rf.setCenter(node.position.x + 110, node.position.y + 48, { zoom: 1, duration: 420 })
  }, [focusId, rf])
  return null
}

function Tab({
  active,
  children,
  onClick,
  onClose,
}: {
  active: boolean
  children: ReactNode
  onClick: () => void
  onClose?: () => void
}) {
  return (
    <div className={`mb-[-1px] flex items-center rounded-t-lg border border-b-0 px-2.5 py-1.5 text-[12px] ${active ? 'border-line bg-[#0c0d10] text-ink' : 'border-transparent text-mute'}`}>
      <button type="button" onClick={onClick} className="max-w-[220px] truncate">
        {children}
      </button>
      {onClose ? (
        <button type="button" onClick={onClose} className="ml-1.5 text-faint hover:text-ink" aria-label="close">
          <X size={12} />
        </button>
      ) : null}
    </div>
  )
}

function Report({ run }: { run: RunRecord }) {
  const { t } = useTranslation()
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {run.nodes
        .filter((node) => node.output)
        .map((node) => (
          <section key={node.id}>
            <h2 className="mb-2 text-[13px] font-semibold">
              {t(`nodes.${node.id}`)} · {t(`status.${node.status}`)}
            </h2>
            <MarkdownView text={node.output} />
          </section>
        ))}
    </div>
  )
}

function Transcripts({ run }: { run: RunRecord }) {
  const { t } = useTranslation()
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {run.nodes.flatMap((node) =>
        node.transcript.map((item) => (
          <article key={item.id}>
            <div className="mb-1 font-mono text-[11px] text-faint">
              {t(`nodes.${node.id}`)} · {item.kind}
              {item.toolStatus ? ` · ${item.toolStatus}` : ''}
            </div>
            <MarkdownView text={item.text} />
          </article>
        )),
      )}
    </div>
  )
}

function messageCount(run?: RunRecord): number {
  if (!run) return 0
  return run.nodes.reduce((sum, node) => sum + node.transcript.length, 0)
}

function toneOf(status?: RunRecord['status']): 'neutral' | 'ok' | 'bad' | 'warn' {
  if (status === 'done') return 'ok'
  if (status === 'failed' || status === 'aborted') return 'bad'
  if (status === 'running') return 'warn'
  return 'neutral'
}

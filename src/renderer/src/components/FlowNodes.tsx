import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { Boxes, CheckCheck, Database, GitFork, Languages, Palette, Search, Wrench } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { NodeStatus } from '@shared/types'
import { cn } from './ui'

export interface FlowData extends Record<string, unknown> {
  nodeId: string
  agent: string
  kind: 'step' | 'gate'
  status: NodeStatus
  attempt: number
}

const ICONS = {
  analyze: Search,
  theme: Palette,
  scaffold: Boxes,
  backend: Database,
  lang: Languages,
  gate: GitFork,
  review: CheckCheck,
  fix: Wrench,
}

export function StepNode({ data, selected }: NodeProps<Node<FlowData>>) {
  const { t } = useTranslation()
  const Icon = ICONS[data.nodeId as keyof typeof ICONS] ?? Search
  const status = data.status
  const label = t(`status.${status === 'idle' ? 'pending' : status}`)
  const attempt = data.attempt > 0 && status !== 'pending' && status !== 'skipped' ? ` · ${t('status.attempt', { n: data.attempt })}` : ''
  return (
    <div
      data-node-id={data.nodeId}
      data-node-status={status}
      className={cn(
        'w-[208px] rounded-xl border bg-[#1b1c22] px-3 py-2.5 shadow-[0_12px_28px_rgba(0,0,0,0.35)]',
        selected && 'ring-1 ring-white/80',
        status === 'done' && 'border-ok/45',
        status === 'failed' && 'border-bad shadow-[0_0_0_1px_rgba(240,113,120,0.45)]',
        status === 'running' && 'border-warn/70',
        (status === 'pending' || status === 'idle') && 'border-white/10',
        status === 'skipped' && 'border-white/8 opacity-45',
        status === 'aborted' && 'border-white/20',
      )}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-[#8d8f9a]" />
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 grid h-6 w-6 place-items-center rounded-md bg-white/6 text-mute">
          <Icon size={13} />
        </span>
        <div className="min-w-0">
          <div className="truncate text-[12.5px] font-medium text-ink">{t(`nodes.${data.nodeId}`)}</div>
          <div className="font-mono text-[10.5px] text-faint">{data.agent}</div>
        </div>
      </div>
      <div
        className={cn(
          'mt-2 flex items-center gap-1.5 text-[11px]',
          status === 'done' && 'text-ok',
          status === 'failed' && 'text-bad',
          status === 'running' && 'text-warn',
          status === 'aborted' && 'text-mute',
          (status === 'pending' || status === 'idle' || status === 'skipped') && 'text-faint',
        )}
      >
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            status === 'done' && 'bg-ok',
            status === 'failed' && 'bg-bad',
            status === 'running' && 'live-dot bg-warn',
            status === 'aborted' && 'bg-mute',
            (status === 'pending' || status === 'idle' || status === 'skipped') && 'bg-faint',
          )}
        />
        <span>
          {label}
          {attempt}
        </span>
      </div>
      {data.kind === 'gate' ? (
        <>
          <Handle id="review" type="source" position={Position.Right} style={{ top: '34%' }} className="!h-2 !w-2 !border-0 !bg-ok" />
          <Handle id="fix" type="source" position={Position.Right} style={{ top: '70%' }} className="!h-2 !w-2 !border-0 !bg-bad" />
        </>
      ) : (
        <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-0 !bg-[#8d8f9a]" />
      )}
    </div>
  )
}

export const nodeTypes = { step: StepNode, gate: StepNode }

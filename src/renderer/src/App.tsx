import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { applyQueryFlags } from './runner'
import { installHost } from './host'
import { useStudio } from './store'
import { CenterStage } from './components/CenterStage'
import { ChatPanel } from './components/ChatPanel'
import { Inspector } from './components/Inspector'
import { RunsPanel } from './components/RunsPanel'
import { SettingsDialog } from './components/SettingsDialog'
import { TitleBar } from './components/TitleBar'

export function App() {
  const { t } = useTranslation()
  const left = useStudio((s) => s.leftWidth)
  const right = useStudio((s) => s.rightWidth)
  const bottom = useStudio((s) => s.bottomHeight)
  const settingsOpen = useStudio((s) => s.settingsOpen)
  const toast = useStudio((s) => s.toast)
  const set = useStudio((s) => s.set)

  useEffect(() => {
    installHost()
    applyQueryFlags()
    const onPanels = (event: Event) => {
      const detail = (event as CustomEvent<{ left?: number; right?: number; bottom?: number }>).detail
      if (!detail) return
      set({
        ...(detail.left ? { leftWidth: detail.left } : {}),
        ...(detail.right ? { rightWidth: detail.right } : {}),
        ...(detail.bottom ? { bottomHeight: detail.bottom } : {}),
      })
    }
    const onSelect = (event: Event) => {
      const nodeId = (event as CustomEvent<string>).detail
      if (typeof nodeId === 'string') set({ selectedNodeId: nodeId, followRun: false, rightTab: 'inspector', inspectorTab: 'output' })
    }
    window.addEventListener('nvas:panels', onPanels)
    window.addEventListener('nvas:select', onSelect)
    return () => {
      window.removeEventListener('nvas:panels', onPanels)
      window.removeEventListener('nvas:select', onSelect)
    }
  }, [set])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => set({ toast: null }), 2400)
    return () => window.clearTimeout(timer)
  }, [toast, set])

  return (
    <div className="flex h-full flex-col bg-canvas text-ink" data-ready="true">
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <ChatPanel width={left} />
        <Splitter
          axis="x"
          onDelta={(delta) => set({ leftWidth: clamp(useStudio.getState().leftWidth + delta, 300, 520) })}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <CenterStage />
          </div>
          <Splitter
            axis="y"
            onDelta={(delta) => set({ bottomHeight: clamp(useStudio.getState().bottomHeight - delta, 168, 520) })}
          />
          <RunsPanel height={bottom} />
        </div>
        <Splitter
          axis="x"
          onDelta={(delta) => set({ rightWidth: clamp(useStudio.getState().rightWidth - delta, 280, 480) })}
        />
        <Inspector width={right} />
      </div>
      {settingsOpen ? <SettingsDialog /> : null}
      {toast ? <div className="fade-up pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-line bg-[#1c1d24] px-3 py-1.5 text-[12px] shadow-xl">{toast}</div> : null}
      <span className="sr-only">{t('app.name')}</span>
    </div>
  )
}

function Splitter({ axis, onDelta }: { axis: 'x' | 'y'; onDelta: (delta: number) => void }) {
  return (
    <div
      role="separator"
      data-resize={axis}
      className={axis === 'x' ? 'w-1 shrink-0 cursor-col-resize bg-transparent hover:bg-white/10' : 'h-1 shrink-0 cursor-row-resize bg-transparent hover:bg-white/10'}
      onPointerDown={(event) => {
        const handle = event.currentTarget
        handle.setPointerCapture(event.pointerId)
        let last = axis === 'x' ? event.clientX : event.clientY
        const move = (ev: PointerEvent) => {
          const point = axis === 'x' ? ev.clientX : ev.clientY
          onDelta(point - last)
          last = point
        }
        const up = () => {
          handle.removeEventListener('pointermove', move)
          handle.removeEventListener('pointerup', up)
        }
        handle.addEventListener('pointermove', move)
        handle.addEventListener('pointerup', up)
      }}
    />
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

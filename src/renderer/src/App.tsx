import { Files, GitCompare, MessageSquare, TerminalSquare, Workflow } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ThreadMode } from '@shared/types'
import { currentCwd, modKey, newChat } from './ade'
import { applyQueryFlags } from './runner'
import { installHost } from './host'
import { hydrateStudio, useStudio } from './store'
import { CenterStage } from './components/CenterStage'
import { ChatThread } from './components/ChatThread'
import { CloneDialog } from './components/CloneDialog'
import { CommandPalette } from './components/CommandPalette'
import { DiffPanel } from './components/DiffPanel'
import { FileTree } from './components/FileTree'
import { Inspector } from './components/Inspector'
import { RunsPanel } from './components/RunsPanel'
import { SettingsDialog } from './components/SettingsDialog'
import { Sidebar } from './components/Sidebar'
import { TerminalPanel } from './components/TerminalPanel'
import { TitleBar } from './components/TitleBar'
import { Welcome } from './components/Welcome'
import { cn } from './components/ui'

export function App() {
  const { t } = useTranslation()
  const [booted, setBooted] = useState(false)
  const projectId = useStudio((s) => s.activeProjectId)
  useStudio((s) => s.activeThreadId)
  const mode = useStudio((s) => s.mode)
  const filesOpen = useStudio((s) => s.filesOpen)
  const settingsOpen = useStudio((s) => s.settingsOpen)
  const paletteOpen = useStudio((s) => s.paletteOpen)
  const cloneOpen = useStudio((s) => s.cloneOpen)
  const toast = useStudio((s) => s.toast)
  const right = useStudio((s) => s.rightWidth)
  const bottom = useStudio((s) => s.bottomHeight)
  const set = useStudio((s) => s.set)
  const project = useStudio((s) => s.projects.find((item) => item.id === s.activeProjectId) ?? null)
  const cwd = currentCwd()

  useEffect(() => {
    let cancel = false
    void hydrateStudio().then(() => {
      if (cancel) return
      installHost()
      applyQueryFlags()
      setBooted(true)
    })
    return () => {
      cancel = true
    }
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey
      if (!meta) return
      if (event.key.toLowerCase() === 'n') {
        event.preventDefault()
        newChat()
      } else if (event.key.toLowerCase() === 'k') {
        event.preventDefault()
        set({ paletteOpen: !useStudio.getState().paletteOpen })
      } else if (event.key === ',') {
        event.preventDefault()
        set({ settingsOpen: true })
      } else if (event.key === '1') set({ mode: 'chat' })
      else if (event.key === '2') set({ mode: 'workflow' })
      else if (event.key === '3') set({ mode: 'diff' })
      else if (event.key === '4') set({ mode: 'terminal' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [set])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => set({ toast: null }), 2800)
    return () => window.clearTimeout(timer)
  }, [toast, set])

  if (!booted) return <div className="h-full bg-canvas" />

  return (
    <div className="flex h-full flex-col bg-canvas text-ink" data-ready="true">
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="flex min-w-0 flex-1 flex-col">
          {project ? (
            <>
              <ModeBar mode={mode} filesOpen={filesOpen} />
              <div className="flex min-h-0 flex-1">
                {mode === 'workflow' ? (
                  <>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="min-h-0 flex-1">
                        <CenterStage />
                      </div>
                      <Splitter axis="y" onDelta={(delta) => set({ bottomHeight: clamp(useStudio.getState().bottomHeight - delta, 160, 480) })} />
                      <RunsPanel height={bottom} />
                    </div>
                    <Splitter axis="x" onDelta={(delta) => set({ rightWidth: clamp(useStudio.getState().rightWidth - delta, 280, 460) })} />
                    <Inspector width={right} />
                  </>
                ) : (
                  <div className="flex min-w-0 flex-1" data-testid="project-open">
                    {filesOpen && mode === 'chat' ? <FileTree cwd={cwd} /> : null}
                    {mode === 'chat' ? <ChatThread /> : null}
                    {mode === 'diff' ? <DiffPanel /> : null}
                    {mode === 'terminal' ? <TerminalPanel cwd={cwd} /> : null}
                  </div>
                )}
              </div>
            </>
          ) : (
            <Welcome />
          )}
        </main>
      </div>
      {settingsOpen ? <SettingsDialog /> : null}
      {paletteOpen ? <CommandPalette /> : null}
      {cloneOpen ? <CloneDialog /> : null}
      {toast ? <div className="fade-up pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-line bg-[#1c1d24] px-3.5 py-2 text-[13px] shadow-xl">{toast}</div> : null}
      <span className="sr-only">{t('app.name')} {projectId ? 'open' : 'welcome'} {modKey()}</span>
    </div>
  )
}

function ModeBar({ mode, filesOpen }: { mode: ThreadMode; filesOpen: boolean }) {
  const { t } = useTranslation()
  const set = useStudio((s) => s.set)
  const thread = useStudio((s) => s.threads.find((item) => item.id === s.activeThreadId))
  const items: { id: ThreadMode; label: string; icon: typeof MessageSquare }[] = [
    { id: 'chat', label: t('ade.modeChat'), icon: MessageSquare },
    { id: 'workflow', label: t('ade.modeWorkflow'), icon: Workflow },
    { id: 'diff', label: t('ade.modeDiff'), icon: GitCompare },
    { id: 'terminal', label: t('ade.modeTerminal'), icon: TerminalSquare },
  ]
  return (
    <div className="flex h-11 items-center gap-1 border-b border-line px-3">
      <div className="mr-2 min-w-0 max-w-[240px] truncate text-[13.5px] font-medium">{thread?.title}</div>
      <div className="flex items-center gap-0.5 rounded-lg bg-white/4 p-0.5">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              data-testid={`mode-${item.id}`}
              onClick={() => set({ mode: item.id })}
              className={cn('inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] transition', mode === item.id ? 'bg-[#2a2a31] text-ink shadow-sm' : 'text-mute hover:text-ink')}
            >
              <Icon size={14} />
              {item.label}
            </button>
          )
        })}
      </div>
      <div className="flex-1" />
      <button type="button" data-testid="files-toggle" onClick={() => set({ filesOpen: !filesOpen, mode: mode === 'chat' ? 'chat' : mode })} className={cn('inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13px]', filesOpen ? 'bg-white/8 text-ink' : 'text-mute hover:bg-white/5')}>
        <Files size={14} />
        {t('ade.files')}
      </button>
    </div>
  )
}

function Splitter({ axis, onDelta }: { axis: 'x' | 'y'; onDelta: (delta: number) => void }) {
  return (
    <div
      role="separator"
      data-resize={axis}
      className={axis === 'x' ? 'w-1.5 shrink-0 cursor-col-resize bg-transparent hover:bg-white/10' : 'h-1.5 shrink-0 cursor-row-resize bg-transparent hover:bg-white/10'}
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

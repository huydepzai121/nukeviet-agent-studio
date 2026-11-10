import { Minus, Settings, Square, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStudio } from '../store'
import { IconButton, Pill } from './ui'

export function TitleBar() {
  const { t } = useTranslation()
  const projects = useStudio((s) => s.projects)
  const activeProjectId = useStudio((s) => s.activeProjectId)
  const busy = useStudio((s) => s.busy)
  const set = useStudio((s) => s.set)
  const project = projects.find((item) => item.id === activeProjectId) ?? projects[0]
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <header className="drag flex h-11 items-center gap-3 border-b border-line bg-panel px-3">
      <div className="flex items-center gap-2.5">
        <Mark />
        <div className="leading-tight">
          <div className="text-[13px] font-semibold tracking-tight">{t('app.name')}</div>
        </div>
      </div>
      <div ref={ref} className="no-drag relative">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex h-7 items-center gap-2 rounded-lg border border-line bg-white/3 px-2.5 text-[12px] hover:bg-white/6"
        >
          <span className="max-w-[180px] truncate text-ink">{project.name}</span>
          <span className="font-mono text-[11px] text-faint">{project.module}</span>
          <span className="rounded bg-white/8 px-1.5 py-0.5 font-mono text-[10px] text-mute">{project.version}</span>
        </button>
        {open ? (
          <div className="fade-up absolute top-full left-0 z-40 mt-1.5 w-72 rounded-xl border border-line bg-[#1a1b21] p-1 shadow-2xl">
            {projects.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  set({ activeProjectId: item.id })
                  setOpen(false)
                }}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left hover:bg-white/6"
              >
                <span>
                  <span className="block text-[13px]">{item.name}</span>
                  <span className="block font-mono text-[11px] text-faint">{item.path}</span>
                </span>
                <span className="font-mono text-[11px] text-mute">{item.version}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <Pill tone={busy ? 'warn' : 'ok'}>
        <span className={busy ? 'live-dot h-1.5 w-1.5 rounded-full bg-warn' : 'h-1.5 w-1.5 rounded-full bg-ok'} />
        {busy ? t('app.running') : t('app.ready')}
      </Pill>
      <div className="flex-1" />
      <div className="no-drag flex items-center gap-0.5">
        <IconButton label={t('app.settings')} onClick={() => set({ settingsOpen: true, settingsSection: 'model' })}>
          <Settings size={15} />
        </IconButton>
        <IconButton label={t('app.minimize')} onClick={() => void window.studio?.minimize()}>
          <Minus size={15} />
        </IconButton>
        <IconButton label={t('app.maximize')} onClick={() => void window.studio?.maximize()}>
          <Square size={13} />
        </IconButton>
        <IconButton label={t('app.close')} onClick={() => void window.studio?.close()} className="hover:bg-bad/20 hover:text-bad">
          <X size={15} />
        </IconButton>
      </div>
    </header>
  )
}

function Mark() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <rect width="22" height="22" rx="6" fill="#1c1e26" stroke="#343744" />
      <path d="M6 15.5V6.5h2.1l3.5 5.7V6.5H13.6v9h-2.1L8 9.8v5.7H6Z" fill="#e8e9ee" />
      <circle cx="16.2" cy="15.4" r="1.35" fill="#3ecf8e" />
    </svg>
  )
}

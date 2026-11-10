import { Minus, Search, Settings, Square, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { modKey } from '../ade'
import { useStudio } from '../store'
import { IconButton } from './ui'
import { VersionBadge } from './Sidebar'

export function TitleBar() {
  const { t } = useTranslation()
  const project = useStudio((s) => s.projects.find((item) => item.id === s.activeProjectId) ?? null)
  const busy = useStudio((s) => s.busy)
  const set = useStudio((s) => s.set)
  return (
    <header className="drag flex h-12 items-center gap-3 border-b border-line bg-[#101013] px-3">
      <div className="flex items-center gap-2.5">
        <Mark />
        <div className="text-[13.5px] font-semibold tracking-tight">{t('app.name')}</div>
      </div>
      {project ? (
        <div className="no-drag flex items-center gap-2 text-[13px]">
          <span className="max-w-[180px] truncate text-ink">{project.name}</span>
          <VersionBadge detected={project.detected} version={project.version} />
          {project.branch ? (
            <span className="font-mono text-[12px] text-faint" title={project.dirty ? t('ade.dirty') : t('ade.clean')}>
              {project.branch}
              {project.dirty ? '*' : ''}
            </span>
          ) : null}
        </div>
      ) : null}
      <button
        type="button"
        data-testid="palette-open"
        onClick={() => set({ paletteOpen: true })}
        className="no-drag ml-2 hidden h-8 min-w-[220px] items-center gap-2 rounded-lg border border-line bg-white/3 px-2.5 text-[13px] text-faint hover:bg-white/6 md:flex"
      >
        <Search size={14} />
        <span className="flex-1 text-left">{t('ade.palettePlaceholder')}</span>
        <kbd className="font-mono text-[11px]">{modKey()}+K</kbd>
      </button>
      <div className="flex-1" />
      <div className="no-drag flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2 py-1 text-[12px] text-mute">
          <span className={busy ? 'live-dot h-1.5 w-1.5 rounded-full bg-warn' : 'h-1.5 w-1.5 rounded-full bg-ok'} />
          {busy ? t('app.running') : t('app.ready')}
        </span>
        <IconButton label={t('app.settings')} onClick={() => set({ settingsOpen: true, settingsSection: 'model' })}>
          <Settings size={16} />
        </IconButton>
        <IconButton label={t('app.minimize')} onClick={() => void window.studio?.minimize()}>
          <Minus size={16} />
        </IconButton>
        <IconButton label={t('app.maximize')} onClick={() => void window.studio?.maximize()}>
          <Square size={13} />
        </IconButton>
        <IconButton label={t('app.close')} onClick={() => void window.studio?.close()} className="hover:bg-bad/20 hover:text-bad">
          <X size={16} />
        </IconButton>
      </div>
    </header>
  )
}

function Mark() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <rect width="22" height="22" rx="6" fill="#1c1e26" stroke="#343744" />
      <path d="M6 15.5V6.5h2.1l3.5 5.7V6.5H13.6v9h-2.1L8 9.8v5.7H6Z" fill="#f4f4f5" />
      <circle cx="16.2" cy="15.4" r="1.35" fill="#3dd68c" />
    </svg>
  )
}

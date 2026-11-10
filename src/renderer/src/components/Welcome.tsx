import { FolderGit2, FolderOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { openFolder, openProjectRecord } from '../ade'
import { useStudio } from '../store'
import { VersionBadge } from './Sidebar'

export function Welcome() {
  const { t } = useTranslation()
  const projects = useStudio((s) => s.projects)
  const set = useStudio((s) => s.set)
  const recent = [...projects].sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0)).slice(0, 6)
  return (
    <div className="h-full overflow-auto bg-canvas" data-testid="welcome">
      <div className="mx-auto flex min-h-full w-full max-w-[880px] flex-col justify-center px-10 py-12">
        <Mark />
        <p className="mt-6 text-[12.5px] font-medium tracking-wide text-info">{t('ade.welcomeKicker')}</p>
        <h1 className="mt-2 text-[32px] leading-tight font-semibold tracking-tight">{t('ade.welcomeTitle')}</h1>
        <p className="mt-3 max-w-[460px] text-[15px] leading-relaxed text-mute">{t('ade.welcomeBody')}</p>
        <div className="mt-7 flex flex-wrap gap-2">
          <button type="button" data-testid="welcome-open" onClick={() => void openFolder()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-white px-3.5 text-[14px] font-medium text-[#111113] transition hover:bg-zinc-100">
            <FolderOpen size={16} />
            {t('ade.openFolder')}
          </button>
          <button type="button" data-testid="welcome-clone" onClick={() => set({ cloneOpen: true })} className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-white/4 px-3.5 text-[14px] transition hover:bg-white/8">
            <FolderGit2 size={16} />
            {t('ade.clone')}
          </button>
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            [t('ade.modeChat'), 'Mock, Claude, Codex, Gemini'],
            [t('ade.modeWorkflow'), 'NukeViet 4.x / 5.x'],
            [t('ade.modeDiff'), 'Accept · Revert'],
          ].map(([title, hint]) => (
            <div key={title} className="rounded-xl border border-line bg-white/3 px-3.5 py-3">
              <div className="text-[13.5px] font-medium">{title}</div>
              <div className="mt-1 text-[12.5px] text-faint">{hint}</div>
            </div>
          ))}
        </div>
        <div className="mt-8">
          <div className="mb-2 text-[12.5px] text-faint">{t('ade.recent')}</div>
          {recent.length === 0 ? <p className="text-[13.5px] text-mute">{t('ade.noRecent')}</p> : null}
          <div className="space-y-1">
            {recent.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => openProjectRecord(project)}
                className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition hover:border-line hover:bg-white/4"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px]">{project.name}</span>
                  <span className="block truncate font-mono text-[12px] text-faint" title={project.path}>
                    {project.path}
                  </span>
                </span>
                <VersionBadge detected={project.detected} version={project.version} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Mark() {
  return (
    <svg width="36" height="36" viewBox="0 0 22 22" aria-hidden="true">
      <rect width="22" height="22" rx="6" fill="#1c1e26" stroke="#3a3d48" />
      <path d="M6 15.5V6.5h2.1l3.5 5.7V6.5H13.6v9h-2.1L8 9.8v5.7H6Z" fill="#f4f4f5" />
      <circle cx="16.2" cy="15.4" r="1.35" fill="#3dd68c" />
    </svg>
  )
}

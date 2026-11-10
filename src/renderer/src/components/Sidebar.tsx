import { FolderGit2, FolderOpen, GitBranch, MoreHorizontal, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isolateThread, modKey, newChat, openFolder } from '../ade'
import { useStudio } from '../store'
import { cn } from './ui'

export function Sidebar() {
  const { t } = useTranslation()
  const projects = useStudio((s) => s.projects)
  const threads = useStudio((s) => s.threads)
  const activeProjectId = useStudio((s) => s.activeProjectId)
  const activeThreadId = useStudio((s) => s.activeThreadId)
  const set = useStudio((s) => s.set)
  const selectThread = useStudio((s) => s.selectThread)
  const patchThread = useStudio((s) => s.patchThread)
  const removeThread = useStudio((s) => s.removeThread)
  const removeProject = useStudio((s) => s.removeProject)
  const [menu, setMenu] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [menu])

  return (
    <aside className="flex h-full w-[272px] shrink-0 flex-col border-r border-line bg-[#101013]" data-testid="sidebar">
      <div className="p-3">
        <button
          type="button"
          data-testid="new-chat"
          onClick={() => newChat()}
          className="flex h-10 w-full items-center gap-2 rounded-lg bg-white px-3 text-[13.5px] font-medium text-[#111113] shadow-sm transition hover:bg-zinc-100"
        >
          <Plus size={16} />
          <span className="flex-1 text-left">{t('ade.newChat')}</span>
          <kbd className="rounded-md bg-black/6 px-1.5 py-0.5 font-mono text-[10px] text-black/50">{modKey()}+N</kbd>
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-2 pb-2">
        <div className="px-2 pb-1.5 text-[12px] text-faint">{t('ade.projects')}</div>
        {projects.length === 0 ? <p className="px-2 py-2 text-[13px] leading-relaxed text-mute">{t('ade.noRecent')}</p> : null}
        {projects.map((project) => {
          const open = project.id === activeProjectId
          const mine = threads.filter((thread) => thread.projectId === project.id)
          return (
            <section key={project.id} className="mb-2">
              <button
                type="button"
                onClick={() => {
                  set({ activeProjectId: project.id })
                  const mine = threads.filter((thread) => thread.projectId === project.id)
                  if (!mine.some((thread) => thread.id === activeThreadId) && mine[0]) selectThread(mine[0].id)
                }}
                className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/5', open && 'bg-white/6')}
              >
                <FolderGit2 size={15} className="shrink-0 text-faint" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{project.name}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-faint">
                    {project.repo !== false && project.branch ? (
                      <span className="inline-flex items-center gap-1 font-mono" title={project.dirty ? t('ade.dirty') : t('ade.clean')}>
                        <GitBranch size={11} />
                        {project.branch}
                        {project.dirty ? <span className="h-1.5 w-1.5 rounded-full bg-warn" /> : null}
                      </span>
                    ) : null}
                  </span>
                </span>
                <VersionBadge detected={project.detected} version={project.version} />
              </button>
              {open ? (
                <div className="mt-0.5 space-y-0.5 pl-2" data-testid="thread-list">
                  {mine.map((thread) => (
                    <div key={thread.id} className={cn('group relative flex items-center rounded-lg pr-1', thread.id === activeThreadId ? 'bg-white/8' : 'hover:bg-white/4')}>
                      {renaming === thread.id ? (
                        <input
                          data-testid="thread-rename"
                          autoFocus
                          value={draft}
                          onChange={(event) => setDraft(event.target.value)}
                          onBlur={() => {
                            patchThread(thread.id, { title: draft.trim() || thread.title, autoTitle: false })
                            setRenaming(null)
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') (event.target as HTMLInputElement).blur()
                            if (event.key === 'Escape') setRenaming(null)
                          }}
                          className="h-8 w-full rounded-lg bg-transparent px-2 text-[13px] outline-none"
                        />
                      ) : (
                        <button
                          type="button"
                          data-testid="thread-row"
                          data-thread-id={thread.id}
                          onClick={() => selectThread(thread.id)}
                          onDoubleClick={() => {
                            setRenaming(thread.id)
                            setDraft(thread.title)
                          }}
                          className="flex h-8 min-w-0 flex-1 items-center px-2 text-left"
                        >
                          <span className="truncate text-[13px]">{thread.title}</span>
                          {thread.worktreeBranch ? <span className="ml-1 shrink-0 font-mono text-[10px] text-info">{thread.worktreeBranch.split('/').pop()}</span> : null}
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label={t('ade.rename')}
                        data-testid="thread-more"
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation()
                          setMenu(menu === thread.id ? null : thread.id)
                        }}
                        className="grid h-7 w-7 place-items-center rounded-md text-faint opacity-0 transition hover:bg-white/8 hover:text-ink group-hover:opacity-100"
                      >
                        <MoreHorizontal size={14} />
                      </button>
                      {menu === thread.id ? (
                        <div className="absolute z-30 mt-24 w-40 rounded-lg border border-line bg-[#1c1c21] p-1 shadow-xl" onMouseDown={(event) => event.stopPropagation()}>
                          <MenuButton
                            label={t('ade.rename')}
                            onClick={() => {
                              setRenaming(thread.id)
                              setDraft(thread.title)
                              setMenu(null)
                            }}
                          />
                          <MenuButton
                            label={t('ade.worktree')}
                            onClick={() => {
                              setMenu(null)
                              void isolateThread()
                            }}
                          />
                          <MenuButton
                            label={t('ade.deleteThread')}
                            onClick={() => {
                              removeThread(thread.id)
                              setMenu(null)
                            }}
                          />
                        </div>
                      ) : null}
                    </div>
                  ))}
                  <button type="button" onClick={() => removeProject(project.id)} className="px-2 py-1 text-[12px] text-faint hover:text-bad">
                    {t('ade.removeProject')}
                  </button>
                </div>
              ) : null}
            </section>
          )
        })}
      </div>
      <div className="grid gap-1 border-t border-line p-2">
        <button type="button" data-testid="open-folder" onClick={() => void openFolder()} className="flex h-9 items-center gap-2 rounded-lg px-2.5 text-[13px] text-mute transition hover:bg-white/6 hover:text-ink">
          <FolderOpen size={15} />
          {t('ade.openFolder')}
        </button>
        <button type="button" data-testid="clone-open" onClick={() => set({ cloneOpen: true })} className="flex h-9 items-center gap-2 rounded-lg px-2.5 text-[13px] text-mute transition hover:bg-white/6 hover:text-ink">
          <FolderGit2 size={15} />
          {t('ade.clone')}
        </button>
      </div>
    </aside>
  )
}

function MenuButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="block w-full rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-white/6">
      {label}
    </button>
  )
}

export function VersionBadge({ detected, version }: { detected?: string; version: string }) {
  const kind = detected ?? version
  const label = kind === 'unknown' ? '·' : kind
  const tone = kind === '5.x' ? 'bg-ok/15 text-ok' : kind === '4.x' ? 'bg-warn/15 text-warn' : 'bg-white/8 text-faint'
  return <span className={cn('rounded-md px-1.5 py-0.5 font-mono text-[10.5px]', tone)}>{label}</span>
}

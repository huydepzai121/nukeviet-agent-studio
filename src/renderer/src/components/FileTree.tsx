import { ChevronDown, ChevronRight, File, Folder } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { DirEntry } from '@shared/types'
import { cn } from './ui'

export function FileTree({ cwd }: { cwd: string }) {
  const { t } = useTranslation()
  return (
    <aside className="flex h-full w-[240px] shrink-0 flex-col border-r border-line bg-[#101013]" data-testid="file-tree">
      <div className="flex h-11 items-center px-3 text-[12.5px] font-medium text-mute">{t('ade.files')}</div>
      <div className="min-h-0 flex-1 overflow-auto px-1.5 pb-3">
        <TreeDir cwd={cwd} rel="" depth={0} />
      </div>
    </aside>
  )
}

function TreeDir({ cwd, rel, depth }: { cwd: string; rel: string; depth: number }) {
  const [entries, setEntries] = useState<DirEntry[] | null>(null)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  useEffect(() => {
    let cancel = false
    void window.studio?.listDir(cwd, rel).then((rows) => {
      if (!cancel) setEntries(rows)
    })
    return () => {
      cancel = true
    }
  }, [cwd, rel])
  if (!entries) return null
  return (
    <div>
      {entries.map((entry) => (
        <div key={entry.path}>
          <button
            type="button"
            onClick={() => entry.kind === 'dir' && setOpen((state) => ({ ...state, [entry.path]: !state[entry.path] }))}
            className="flex h-7 w-full items-center gap-1.5 rounded-md px-1.5 text-left text-[13px] text-mute hover:bg-white/5 hover:text-ink"
            style={{ paddingLeft: 6 + depth * 12 }}
          >
            {entry.kind === 'dir' ? open[entry.path] ? <ChevronDown size={13} /> : <ChevronRight size={13} /> : <span className="w-[13px]" />}
            {entry.kind === 'dir' ? <Folder size={13} className="text-warn/80" /> : <File size={13} className="text-faint" />}
            <span className={cn('truncate', entry.kind === 'dir' && 'text-ink')}>{entry.name}</span>
          </button>
          {entry.kind === 'dir' && open[entry.path] ? <TreeDir cwd={cwd} rel={entry.path} depth={depth + 1} /> : null}
        </div>
      ))}
    </div>
  )
}

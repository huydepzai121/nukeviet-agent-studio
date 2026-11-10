import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { DiffFile } from '@shared/types'
import { currentCwd } from '../ade'
import { cn } from './ui'

export function DiffPanel() {
  const { t } = useTranslation()
  const [files, setFiles] = useState<DiffFile[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [error, setError] = useState('')
  const cwd = currentCwd()

  async function load() {
    if (!window.studio || !cwd) {
      setFiles([])
      return
    }
    try {
      const rows = await window.studio.gitDiff(cwd)
      setFiles(rows)
      setActive((current) => (current && rows.some((file) => file.path === current) ? current : rows[0]?.path ?? null))
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  useEffect(() => {
    void load()
  }, [cwd])

  const file = files.find((item) => item.path === active) ?? null

  async function act(action: 'accept' | 'revert', target: DiffFile) {
    if (!window.studio) return
    await window.studio.gitFileAction(cwd, target.path, action)
    await load()
  }

  return (
    <section className="flex h-full min-h-0 bg-canvas" data-testid="diff-panel">
      <div className="flex w-[280px] shrink-0 flex-col border-r border-line">
        <header className="flex h-11 items-center justify-between px-3">
          <span className="text-[13px] font-medium">{t('ade.unstaged')}</span>
          <button type="button" onClick={() => void load()} className="text-[12.5px] text-mute hover:text-ink">
            {t('ade.refresh')}
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto p-1.5">
          {files.length === 0 ? <p className="px-2 py-6 text-[13px] text-faint">{t('ade.diffEmpty')}</p> : null}
          {files.map((item) => (
            <button key={item.path} type="button" data-testid="diff-file" onClick={() => setActive(item.path)} className={cn('mb-0.5 w-full rounded-lg px-2.5 py-2 text-left', item.path === active ? 'bg-white/8' : 'hover:bg-white/4')}>
              <div className="truncate font-mono text-[12.5px]">{item.path}</div>
              <div className="mt-0.5 text-[12px]">
                <span className="text-ok">+{item.additions}</span> <span className="text-bad">-{item.deletions}</span>
                {item.untracked ? <span className="ml-2 text-faint">new</span> : null}
              </div>
            </button>
          ))}
        </div>
      </div>
      <div className="min-w-0 flex-1 overflow-auto">
        {!file ? (
          <div className="grid h-full place-items-center px-8 text-center">
            <div>
              <div className="text-[16px] font-medium">{t('ade.diffEmpty')}</div>
              <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-mute">{error || t('ade.diffEmptyHint')}</p>
            </div>
          </div>
        ) : (
          <div>
            <header className="sticky top-0 flex h-11 items-center gap-2 border-b border-line bg-canvas/95 px-4 backdrop-blur">
              <span className="min-w-0 flex-1 truncate font-mono text-[13px]">{file.path}</span>
              <button type="button" data-testid="diff-accept" onClick={() => void act('accept', file)} className="h-8 rounded-lg bg-white px-2.5 text-[13px] font-medium text-[#111113]">
                {t('ade.accept')}
              </button>
              <button type="button" data-testid="diff-revert" onClick={() => void act('revert', file)} className="h-8 rounded-lg border border-bad/40 px-2.5 text-[13px] text-bad hover:bg-bad/10">
                {t('ade.revert')}
              </button>
            </header>
            {file.binary ? <p className="p-4 text-[13px] text-mute">{t('ade.binary')}</p> : <Patch patch={file.patch} />}
          </div>
        )}
      </div>
    </section>
  )
}

function Patch({ patch }: { patch: string }) {
  const lines = patch.split('\n').slice(0, 400)
  return (
    <pre className="m-0 p-4 font-mono text-[12.5px] leading-relaxed">
      {lines.map((line, index) => (
        <div key={index} className={line.startsWith('+') && !line.startsWith('+++') ? 'diff-line-add' : line.startsWith('-') && !line.startsWith('---') ? 'diff-line-del' : 'text-mute'}>
          {line || ' '}
        </div>
      ))}
    </pre>
  )
}

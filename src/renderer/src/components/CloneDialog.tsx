import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { finishClone } from '../ade'
import { useStudio } from '../store'

export function CloneDialog() {
  const { t } = useTranslation()
  const set = useStudio((s) => s.set)
  const [url, setUrl] = useState('https://github.com/nukeviet/nukeviet.git')
  const [branch, setBranch] = useState('nukeviet5.0')
  const [dest, setDest] = useState('')
  const [shallow, setShallow] = useState(true)
  const [log, setLog] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!window.studio) return
    return window.studio.onCloneProgress((payload) => {
      setLog((lines) => [...lines.slice(-12), payload.line])
      if (payload.error) setError(payload.error)
    })
  }, [])

  async function browse() {
    const folder = await window.studio?.pickFolder()
    if (folder) setDest(folder)
  }

  async function start() {
    if (!window.studio) {
      setError(t('ade.desktopOnly'))
      return
    }
    if (!url.trim()) {
      setError(t('ade.cloneNeedUrl'))
      return
    }
    if (!dest) {
      setError(t('ade.cloneNeedDest'))
      return
    }
    setBusy(true)
    setError('')
    setLog([])
    try {
      const result = await window.studio.cloneRepo({ url: url.trim(), parentDir: dest, shallow, branch: branch.trim() })
      await finishClone(result.path)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-6" data-testid="clone-dialog" onMouseDown={() => !busy && set({ cloneOpen: false })}>
      <div className="fade-up w-full max-w-[520px] rounded-2xl border border-line bg-[#16161a] p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <h2 className="text-[16px] font-semibold">{t('ade.cloneTitle')}</h2>
        <label className="mt-4 block text-[12.5px] text-mute">
          {t('ade.cloneUrl')}
          <input data-testid="clone-url" value={url} onChange={(event) => setUrl(event.target.value)} spellCheck={false} className="mt-1.5 h-10 w-full rounded-lg border border-line bg-black/30 px-3 font-mono text-[13px] outline-none focus:border-white/25" />
        </label>
        <label className="mt-3 block text-[12.5px] text-mute">
          {t('ade.cloneBranch')}
          <input data-testid="clone-branch" value={branch} onChange={(event) => setBranch(event.target.value)} spellCheck={false} placeholder="nukeviet5.0" className="mt-1.5 h-10 w-full rounded-lg border border-line bg-black/30 px-3 font-mono text-[13px] outline-none focus:border-white/25" />
          <span className="mt-1 block text-[12px] text-faint">{t('ade.cloneBranchHint')}</span>
        </label>
        <div className="mt-3 text-[12.5px] text-mute">{t('ade.cloneDest')}</div>
        <div className="mt-1.5 flex gap-2">
          <input data-testid="clone-dest" value={dest} onChange={(event) => setDest(event.target.value)} spellCheck={false} placeholder="/home/me/src" className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-black/30 px-3 font-mono text-[12.5px] outline-none focus:border-white/25" />
          <button type="button" data-testid="clone-browse" onClick={() => void browse()} className="h-10 shrink-0 rounded-lg border border-line px-3 text-[13px] hover:bg-white/6">
            {t('ade.cloneBrowse')}
          </button>
        </div>
        <label className="mt-3 flex items-center gap-2 text-[13px] text-mute">
          <input data-testid="clone-shallow" type="checkbox" checked={shallow} onChange={(event) => setShallow(event.target.checked)} />
          {t('ade.cloneShallow')}
        </label>
        {log.length > 0 ? (
          <pre data-testid="clone-log" className="mt-3 max-h-28 overflow-auto rounded-lg bg-black/40 p-2 font-mono text-[11.5px] leading-relaxed text-mute">
            {log.join('\n')}
          </pre>
        ) : null}
        {error ? <p className="mt-3 text-[13px] text-bad">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={() => (busy ? void window.studio?.cancelClone() : set({ cloneOpen: false }))} className="h-9 rounded-lg px-3 text-[13px] text-mute hover:bg-white/6">
            {t('ade.cloneCancel')}
          </button>
          <button type="button" data-testid="clone-start" disabled={busy} onClick={() => void start()} className="h-9 rounded-lg bg-white px-3 text-[13px] font-medium text-[#111113] disabled:opacity-50">
            {busy ? t('ade.cloneStart') + '…' : t('ade.cloneStart')}
          </button>
        </div>
      </div>
    </div>
  )
}

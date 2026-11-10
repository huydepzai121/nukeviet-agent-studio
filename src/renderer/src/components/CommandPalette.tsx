import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { paletteItems } from '../ade'
import { useStudio } from '../store'

export function CommandPalette() {
  const { t } = useTranslation()
  const set = useStudio((s) => s.set)
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    return paletteItems().filter((item) => !q || `${item.label} ${item.hint ?? ''}`.toLowerCase().includes(q))
  }, [query])

  useEffect(() => setCursor(0), [query])

  function run(index: number) {
    const item = items[index]
    if (!item) return
    set({ paletteOpen: false })
    item.run()
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-start justify-center bg-black/55 pt-[14vh]" data-testid="palette" onMouseDown={() => set({ paletteOpen: false })}>
      <div className="fade-up w-full max-w-[560px] overflow-hidden rounded-2xl border border-line bg-[#16161a] shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <input
          autoFocus
          value={query}
          data-testid="palette-input"
          placeholder={t('ade.palettePlaceholder')}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setCursor((value) => Math.min(items.length - 1, value + 1))
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              setCursor((value) => Math.max(0, value - 1))
            } else if (event.key === 'Enter') {
              event.preventDefault()
              run(cursor)
            } else if (event.key === 'Escape') set({ paletteOpen: false })
          }}
          className="h-12 w-full bg-transparent px-4 text-[15px] outline-none placeholder:text-faint"
        />
        <div className="max-h-[320px] overflow-auto border-t border-line p-1.5">
          {items.length === 0 ? <p className="px-3 py-6 text-center text-[13px] text-faint">{t('ade.search')}</p> : null}
          {items.slice(0, 12).map((item, index) => (
            <button key={item.id} type="button" onMouseEnter={() => setCursor(index)} onClick={() => run(index)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ${index === cursor ? 'bg-white/8' : ''}`}>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px]">{item.label}</span>
                {item.hint ? <span className="block truncate text-[12px] text-faint">{item.hint}</span> : null}
              </span>
              {item.kbd ? <kbd className="font-mono text-[11px] text-faint">{item.kbd}</kbd> : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

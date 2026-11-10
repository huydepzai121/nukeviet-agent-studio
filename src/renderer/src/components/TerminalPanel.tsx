import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { useEffect, useRef, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'

export function TerminalPanel({ cwd }: { cwd: string }) {
  const { t } = useTranslation()
  const host = useRef<HTMLDivElement>(null)
  return (
    <section className="flex h-full min-h-0 flex-col bg-[#0a0a0c]" data-testid="terminal">
      <header className="flex h-11 items-center gap-2 border-b border-line px-3 text-[13px]">
        <span className="font-medium">{t('ade.modeTerminal')}</span>
        <span className="truncate font-mono text-[12px] text-faint">{cwd}</span>
      </header>
      <div ref={host} className="min-h-0 flex-1 p-2" />
      <Wire cwd={cwd} host={host} />
    </section>
  )
}

function Wire({ cwd, host }: { cwd: string; host: RefObject<HTMLDivElement | null> }) {
  useEffect(() => {
    const node = host.current
    if (!node || !window.studio || !cwd) return
    const term = new Terminal({
      fontFamily: '"JetBrains Mono Variable", ui-monospace, monospace',
      fontSize: 13,
      cursorBlink: true,
      theme: { background: '#0a0a0c', foreground: '#e4e4e7', cursor: '#a5b4fc', selectionBackground: '#3f3f46' },
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(node)
    fit.fit()
    let closed = false
    let id = ''
    const off = window.studio.onTerminal(({ id: sid, data }) => {
      if (sid === id) term.write(data)
    })
    void window.studio.terminalOpen(cwd).then((session) => {
      if (closed) {
        void window.studio?.terminalClose(session.id)
        return
      }
      id = session.id
      term.onData((data) => void window.studio?.terminalWrite(id, data))
      void window.studio?.terminalResize(id, term.cols, term.rows)
      term.focus()
    })
    const observer = new ResizeObserver(() => {
      fit.fit()
      if (id) void window.studio?.terminalResize(id, term.cols, term.rows)
    })
    observer.observe(node)
    return () => {
      closed = true
      observer.disconnect()
      off()
      if (id) void window.studio?.terminalClose(id)
      term.dispose()
    }
  }, [cwd, host])
  return null
}

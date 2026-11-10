import { ArrowUp, Square } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { commandList, startRun, stopActive, submitChat } from '../runner'
import { useStudio } from '../store'
import { formatTime } from '../lib/format'
import { MarkdownView } from './MarkdownView'
import { Menu } from './ui'

export function ChatPanel({ width }: { width: number }) {
  const { t } = useTranslation()
  const messages = useStudio((s) => s.messages)
  const settings = useStudio((s) => s.settings)
  const agentId = useStudio((s) => s.agentId)
  const busy = useStudio((s) => s.busy)
  const project = useStudio((s) => s.projects.find((item) => item.id === s.activeProjectId) ?? s.projects[0])
  const set = useStudio((s) => s.set)
  const patchSettings = useStudio((s) => s.patchSettings)
  const [draft, setDraft] = useState('')
  const [cursor, setCursor] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const stick = useRef(true)

  const commands = useMemo(() => {
    if (!draft.startsWith('/')) return []
    const token = draft.slice(1).split(/\s/)[0].toLowerCase()
    return commandList().filter((command) => command.slash.slice(1).startsWith(token))
  }, [draft, settings.lang])

  useEffect(() => {
    if (!stick.current) return
    const node = listRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages])

  async function send() {
    const text = draft
    setDraft('')
    await submitChat(text)
  }

  return (
    <section className="flex h-full min-h-0 flex-col border-r border-line bg-panel" style={{ width }} data-testid="chat">
      <header className="flex h-11 items-center justify-between border-b border-line px-3.5">
        <div>
          <div className="text-[12.5px] font-medium">{t('chat.title')}</div>
          <div className="font-mono text-[10.5px] text-faint">
            {project.module} · {project.version}
          </div>
        </div>
      </header>
      <div
        ref={listRef}
        onScroll={(event) => {
          const node = event.currentTarget
          stick.current = node.scrollHeight - node.scrollTop - node.clientHeight < 40
        }}
        className="min-h-0 flex-1 space-y-4 overflow-auto px-3.5 py-3.5"
      >
        {messages.length === 0 ? <p className="text-faint">{t('chat.empty')}</p> : null}
        {messages.map((message) => (
          <article key={message.id} className="fade-up">
            <header className="mb-1 flex items-center gap-2 text-[11px] text-faint">
              <span className="text-mute">{message.role === 'user' ? t('chat.you') : t('chat.title')}</span>
              <span>{formatTime(message.createdAt)}</span>
              {message.role === 'assistant' && message.durationMs ? (
                <span>{t('chat.worked', { seconds: Math.max(1, Math.round(message.durationMs / 1000)), tools: message.toolCalls ?? 0 })}</span>
              ) : null}
              {message.stopped ? <span className="text-bad">{t('chat.stopped')}</span> : null}
            </header>
            <div className={message.role === 'user' ? 'rounded-xl bg-white/4 px-3 py-2' : ''}>
              <MarkdownView text={message.text} />
              {message.pending && !message.text ? <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-warn" /> : null}
            </div>
          </article>
        ))}
      </div>
      <div className="p-3">
        {commands.length > 0 ? (
          <div className="fade-up mb-2 overflow-hidden rounded-xl border border-line bg-[#1a1b21]">
            {commands.map((command, index) => (
              <button
                key={command.id}
                type="button"
                onMouseEnter={() => setCursor(index)}
                onClick={() => {
                  setDraft(`${command.slash} `)
                }}
                className={`flex w-full items-baseline gap-3 px-3 py-2 text-left ${index === cursor ? 'bg-white/6' : ''}`}
              >
                <span className="font-mono text-[12px] text-ink">{command.slash}</span>
                <span className="text-[12px] text-mute">{command.description}</span>
              </button>
            ))}
          </div>
        ) : null}
        <div className="rounded-2xl border border-line bg-[#0e0f13] focus-within:border-white/20">
          <textarea
            value={draft}
            rows={3}
            placeholder={`${t('chat.placeholder')}  ·  ${t('chat.hint')}`}
            onChange={(event) => {
              setDraft(event.target.value)
              setCursor(0)
            }}
            onKeyDown={(event) => {
              if (commands.length && event.key === 'ArrowDown') {
                event.preventDefault()
                setCursor((value) => (value + 1) % commands.length)
              } else if (commands.length && event.key === 'ArrowUp') {
                event.preventDefault()
                setCursor((value) => (value - 1 + commands.length) % commands.length)
              } else if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                if (commands.length && draft.trim() === '/') {
                  setDraft(`${commands[cursor].slash} `)
                  return
                }
                void send()
              } else if (event.key === 'Escape') {
                setDraft('')
              }
            }}
            className="max-h-40 w-full resize-none bg-transparent px-3 pt-2.5 pb-1 outline-none placeholder:text-faint"
          />
          <div className="flex items-center gap-1 px-1.5 pb-1.5">
            <Menu
              label="agent"
              value={agentId}
              onChange={(id) => set({ agentId: id })}
              items={settings.agents.map((agent) => ({ id: agent.id, label: agent.name, hint: agent.builtin ? 'ACP' : agent.command }))}
            />
            <Menu
              label="model"
              value={settings.model}
              onChange={(id) => patchSettings({ model: id })}
              items={settings.models.map((model) => ({ id: model, label: model }))}
            />
            <div className="flex-1" />
            {busy ? (
              <button
                type="button"
                aria-label={t('chat.stop')}
                onClick={() => stopActive()}
                className="grid h-8 w-8 place-items-center rounded-full bg-white text-canvas"
              >
                <Square size={12} fill="currentColor" />
              </button>
            ) : (
              <button
                type="button"
                aria-label={t('chat.send')}
                disabled={!draft.trim()}
                onClick={() => void send()}
                className="grid h-8 w-8 place-items-center rounded-full bg-white text-canvas disabled:bg-white/15 disabled:text-faint"
              >
                <ArrowUp size={16} />
              </button>
            )}
          </div>
        </div>
        <button type="button" className="sr-only" data-testid="run-workflow" onClick={() => void startRun()}>
          {t('runs.play')}
        </button>
      </div>
    </section>
  )
}

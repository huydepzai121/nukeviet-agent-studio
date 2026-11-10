import { ArrowUp, Check, Square } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { commandList, startRun, stopActive, submitChat } from '../runner'
import { useStudio } from '../store'
import { formatTime } from '../lib/format'
import { MarkdownView } from './MarkdownView'
import { Menu } from './ui'

export function ChatThread() {
  const { t } = useTranslation()
  const messages = useStudio((s) => s.messages)
  const settings = useStudio((s) => s.settings)
  const agentId = useStudio((s) => s.agentId)
  const busy = useStudio((s) => s.busy)
  const thread = useStudio((s) => s.threads.find((item) => item.id === s.activeThreadId) ?? null)
  const patchThread = useStudio((s) => s.patchThread)
  const patchMessage = useStudio((s) => s.patchMessage)
  const patchSettings = useStudio((s) => s.patchSettings)
  const set = useStudio((s) => s.set)
  const [draft, setDraft] = useState('')
  const [cursor, setCursor] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const stick = useRef(true)

  const commands = useMemo(() => {
    if (!draft.startsWith('/')) return []
    const token = draft.slice(1).split(/\s/)[0]?.toLowerCase() ?? ''
    return commandList().filter((command) => command.slash.slice(1).startsWith(token))
  }, [draft, settings.lang])

  useEffect(() => {
    if (!stick.current) return
    const node = listRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages])

  async function send(text = draft) {
    setDraft('')
    await submitChat(text)
  }

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-canvas" data-testid="chat">
      <div
        ref={listRef}
        onScroll={(event) => {
          const node = event.currentTarget
          stick.current = node.scrollHeight - node.scrollTop - node.clientHeight < 48
        }}
        className="min-h-0 flex-1 overflow-auto px-6 py-5"
      >
        {messages.length === 0 ? (
          <div className="mx-auto max-w-[640px] pt-16">
            <h2 className="text-[20px] font-semibold tracking-tight">{t('ade.emptyChatTitle')}</h2>
            <p className="mt-2 max-w-[460px] text-[14px] leading-relaxed text-mute">{t('ade.emptyChat')}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {[t('ade.suggestRun'), t('ade.suggestTheme'), t('ade.suggestLang')].map((label) => (
                <button key={label} type="button" onClick={() => void send(label === t('ade.suggestRun') ? '/run' : label)} className="rounded-full border border-line px-3 py-1.5 text-[13px] text-mute transition hover:bg-white/6 hover:text-ink">
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-[760px] space-y-5">
            {messages.map((message) => (
              <article key={message.id} className="fade-up" data-testid={message.pending ? 'assistant-stream' : undefined}>
                <header className="mb-1.5 flex items-center gap-2 text-[12px] text-faint">
                  <span className="text-mute">{message.role === 'user' ? t('chat.you') : thread?.title || t('chat.title')}</span>
                  <span>{formatTime(message.createdAt)}</span>
                  {message.role === 'assistant' && message.durationMs ? <span>{t('chat.worked', { seconds: Math.max(1, Math.round(message.durationMs / 1000)), tools: message.toolCalls ?? 0 })}</span> : null}
                  {message.stopped ? <span className="text-bad">{t('chat.stopped')}</span> : null}
                </header>
                <div className={message.role === 'user' ? 'rounded-2xl bg-white/6 px-3.5 py-2.5' : ''}>
                  {(message.parts ?? []).map((part) => {
                    if (part.kind === 'plan') {
                      return (
                        <div key={part.id} className="mb-3 rounded-xl border border-line bg-white/3 p-3">
                          <div className="mb-1.5 text-[12px] text-faint">{t('ade.plan')}</div>
                          <ul className="space-y-1">
                            {(part.entries ?? []).map((entry) => (
                              <li key={entry.content} className="flex items-center gap-2 text-[13px]">
                                <span className={entry.status === 'completed' ? 'text-ok' : entry.status === 'in_progress' ? 'text-warn' : 'text-faint'}>●</span>
                                {entry.content}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )
                    }
                    if (part.kind === 'permission') {
                      return (
                        <div key={part.id} data-testid="permission-card" className="mb-3 rounded-xl border border-warn/30 bg-warn/8 p-3">
                          <div className="text-[12px] text-warn">{t('ade.permission')}</div>
                          <div className="mt-1 text-[14px]">{part.title}</div>
                          {part.selected ? (
                            <div className="mt-2 inline-flex items-center gap-1 text-[12.5px] text-ok">
                              <Check size={13} />
                              {part.options?.find((option) => option.id === part.selected)?.name}
                            </div>
                          ) : (
                            <div className="mt-2 flex gap-2">
                              {(part.options ?? []).map((option) => (
                                <button
                                  key={option.id}
                                  type="button"
                                  data-testid={`perm-${option.id}`}
                                  onClick={() => {
                                    patchMessage(message.id, {
                                      parts: (message.parts ?? []).map((item) => (item.id === part.id ? { ...item, selected: option.id } : item)),
                                    })
                                    void window.studio?.respondPermission(message.id, option.id)
                                  }}
                                  className="h-8 rounded-lg border border-line bg-black/20 px-2.5 text-[13px] hover:bg-white/8"
                                >
                                  {option.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    }
                    if (part.kind === 'tool') {
                      return (
                        <div key={part.id} className="mb-1.5 flex items-center gap-2 font-mono text-[12.5px] text-mute">
                          <span className={part.toolStatus === 'completed' ? 'text-ok' : part.toolStatus === 'failed' ? 'text-bad' : 'text-warn'}>▸</span>
                          <span>{part.text}</span>
                        </div>
                      )
                    }
                    if (part.kind === 'thought' && part.text) {
                      return <p key={part.id} className="mb-2 text-[13px] text-faint italic">{part.text}</p>
                    }
                    return null
                  })}
                  {message.text ? <MarkdownView text={message.text} /> : null}
                  {message.pending && !message.text ? <span className="live-dot inline-block h-2 w-2 rounded-full bg-warn" /> : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
      <div className="px-6 pb-4">
        <div className="mx-auto max-w-[760px]">
          {commands.length > 0 ? (
            <div className="mb-2 overflow-hidden rounded-xl border border-line bg-[#1a1b21]">
              {commands.map((command, index) => (
                <button key={command.id} type="button" onMouseEnter={() => setCursor(index)} onClick={() => setDraft(`${command.slash} `)} className={`flex w-full items-baseline gap-3 px-3 py-2 text-left ${index === cursor ? 'bg-white/6' : ''}`}>
                  <span className="font-mono text-[13px]">{command.slash}</span>
                  <span className="text-[13px] text-mute">{command.description}</span>
                </button>
              ))}
            </div>
          ) : null}
          <div className="rounded-2xl border border-line bg-[#121216] focus-within:border-white/20">
            <textarea
              data-testid="composer"
              value={draft}
              rows={3}
              placeholder={t('chat.placeholder')}
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
                  void send()
                }
              }}
              className="max-h-40 w-full resize-none bg-transparent px-3.5 pt-3 pb-1 text-[14px] outline-none placeholder:text-faint"
            />
            <div className="flex items-center gap-1 px-2 pb-2">
              <Menu
                label="agent"
                value={agentId}
                onChange={(id) => {
                  set({ agentId: id })
                  if (thread) {
                    patchThread(thread.id, { agentId: id })
                    void window.studio?.closeSession(thread.id)
                  }
                }}
                items={settings.agents.map((agent) => ({ id: agent.id, label: agent.name, hint: agent.builtin ? 'ACP' : agent.command || '—' }))}
              />
              <Menu label="model" value={settings.model} onChange={(id) => patchSettings({ model: id })} items={settings.models.map((model) => ({ id: model, label: model }))} />
              <div className="flex-1" />
              {busy ? (
                <button type="button" aria-label={t('chat.stop')} onClick={() => stopActive()} className="grid h-8 w-8 place-items-center rounded-full bg-white text-[#111113]">
                  <Square size={12} fill="currentColor" />
                </button>
              ) : (
                <button type="button" aria-label={t('chat.send')} data-testid="send" disabled={!draft.trim()} onClick={() => void send()} className="grid h-8 w-8 place-items-center rounded-full bg-white text-[#111113] disabled:bg-white/12 disabled:text-faint">
                  <ArrowUp size={16} />
                </button>
              )}
            </div>
          </div>
          <button type="button" className="sr-only" data-testid="run-workflow" onClick={() => void startRun()}>
            {t('runs.play')}
          </button>
        </div>
      </div>
    </section>
  )
}

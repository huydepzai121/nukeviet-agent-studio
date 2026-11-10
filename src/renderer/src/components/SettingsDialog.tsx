import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { modelsEndpoint, providerEnv, redactEnv } from '@shared/provider'
import type { GatewayMode, Lang, Settings } from '@shared/types'
import { setLanguage } from '../runner'
import { useStudio, type SettingsSection } from '../store'
import { uid } from '../lib/format'
import { Field, TextInput, cn } from './ui'

let memoryKey = ''

export function SettingsDialog() {
  const { t } = useTranslation()
  const section = useStudio((s) => s.settingsSection)
  const set = useStudio((s) => s.set)
  const sections: SettingsSection[] = ['model', 'agents', 'project', 'language']
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-6 backdrop-blur-[2px]" data-testid="settings" onMouseDown={() => set({ settingsOpen: false })}>
      <div className="fade-up grid h-[min(720px,100%)] w-[min(980px,100%)] grid-cols-[200px_1fr] overflow-hidden rounded-2xl border border-line bg-[#14151a] shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <aside className="border-r border-line bg-black/20 p-3">
          <div className="px-2 py-2 text-[12px] text-faint">{t('settings.title')}</div>
          {sections.map((item) => (
            <button key={item} type="button" onClick={() => set({ settingsSection: item })} className={cn('mb-0.5 block w-full rounded-lg px-2.5 py-2 text-left text-[13px]', section === item ? 'bg-white/8 text-ink' : 'text-mute hover:bg-white/4')}>
              {t(`settings.${item}`)}
            </button>
          ))}
        </aside>
        <section className="flex min-h-0 flex-col">
          <header className="flex h-12 items-center justify-between border-b border-line px-5">
            <div className="text-[14px] font-medium">{t(`settings.${section}`)}</div>
            <button type="button" aria-label={t('settings.close')} onClick={() => set({ settingsOpen: false })} className="grid h-7 w-7 place-items-center rounded-md text-mute hover:bg-white/6 hover:text-ink">
              <X size={15} />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-auto px-5 py-5">
            {section === 'model' ? <ModelSection /> : null}
            {section === 'agents' ? <AgentsSection /> : null}
            {section === 'project' ? <ProjectSection /> : null}
            {section === 'language' ? <LanguageSection /> : null}
          </div>
        </section>
      </div>
    </div>
  )
}

function ModelSection() {
  const { t } = useTranslation()
  const settings = useStudio((s) => s.settings)
  const patchSettings = useStudio((s) => s.patchSettings)
  const secretSaved = useStudio((s) => s.secretSaved)
  const secretStorage = useStudio((s) => s.secretStorage)
  const set = useStudio((s) => s.set)
  const [key, setKey] = useState('')
  const [modelDraft, setModelDraft] = useState('')
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState('')

  useEffect(() => {
    void window.studio?.secretStatus().then((status) => {
      set({ secretSaved: status.saved, secretStorage: status.storage })
    })
  }, [set])

  const preview = envPreview(settings, secretSaved || key.trim().length > 0)

  async function saveKey() {
    const value = key.trim()
    if (!value) return
    if (window.studio) {
      const saved = await window.studio.saveSecret(value)
      set({ secretSaved: true, secretStorage: saved.storage, toast: t('settings.savedSafe') })
    } else {
      memoryKey = value
      set({ secretSaved: true, secretStorage: 'memory', toast: t('settings.savedMemory') })
    }
    setKey('')
  }

  async function clearKey() {
    if (window.studio) await window.studio.clearSecret()
    memoryKey = ''
    set({ secretSaved: false, secretStorage: null })
  }

  async function test() {
    setTesting(true)
    setResult('')
    try {
      if (window.studio) {
        const response = await window.studio.testProvider({ gateway: settings.gateway, baseUrl: settings.baseUrl, model: settings.model, apiKey: key.trim() || undefined })
        setResult(response.message)
      } else {
        const token = key.trim() || memoryKey
        if (!token) {
          setResult(t('settings.noKey'))
          return
        }
        const endpoint = modelsEndpoint(settings.baseUrl)
        const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } })
        setResult(response.ok ? `${endpoint}` : `${response.status} ${endpoint}`)
      }
    } catch (error) {
      setResult(error instanceof Error ? error.message : String(error))
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <Field label={t('settings.gateway')}>
        <div className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-black/20 p-1">
          {(['both', 'openai', 'anthropic'] as GatewayMode[]).map((mode) => (
            <button key={mode} type="button" onClick={() => patchSettings({ gateway: mode })} className={cn('rounded-lg px-2 py-1.5 text-[12px]', settings.gateway === mode ? 'bg-white/10 text-ink' : 'text-mute')}>
              {t(`settings.${mode}`)}
            </button>
          ))}
        </div>
      </Field>
      <Field label={t('settings.baseUrl')} hint={t('settings.baseHint')}>
        <TextInput value={settings.baseUrl} onChange={(event) => patchSettings({ baseUrl: event.target.value })} spellCheck={false} />
      </Field>
      <Field label={t('settings.apiKey')} hint={secretHint(t, secretSaved, secretStorage)}>
        <div className="flex gap-2">
          <TextInput type="password" autoComplete="off" value={key} placeholder={t('settings.apiPlaceholder')} onChange={(event) => setKey(event.target.value)} spellCheck={false} />
          <button type="button" onClick={() => void saveKey()} className="h-9 shrink-0 rounded-lg bg-white px-3 text-[12.5px] font-medium text-canvas">
            {t('settings.saveKey')}
          </button>
          <button type="button" onClick={() => void clearKey()} className="h-9 shrink-0 rounded-lg border border-line px-3 text-[12.5px] text-mute">
            {t('settings.clearKey')}
          </button>
        </div>
      </Field>
      <Field label={t('settings.models')}>
        <div className="space-y-1">
          {settings.models.map((model) => (
            <label key={model} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/4">
              <input type="radio" name="model" checked={settings.model === model} onChange={() => patchSettings({ model })} />
              <span className="font-mono text-[12.5px]">{model}</span>
            </label>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <TextInput value={modelDraft} placeholder={t('settings.modelPlaceholder')} onChange={(event) => setModelDraft(event.target.value)} spellCheck={false} />
          <button
            type="button"
            onClick={() => {
              const next = modelDraft.trim()
              if (!next || settings.models.includes(next)) return
              patchSettings({ models: [...settings.models, next], model: next })
              setModelDraft('')
            }}
            className="h-9 shrink-0 rounded-lg border border-line px-3 text-[12.5px]"
          >
            {t('settings.addModel')}
          </button>
        </div>
      </Field>
      <div>
        <button type="button" onClick={() => void test()} className="rounded-lg border border-line px-3 py-1.5 text-[12.5px] hover:bg-white/5">
          {testing ? t('settings.testing') : t('settings.test')}
        </button>
        {result ? <p className="mt-2 font-mono text-[11.5px] text-mute">{result}</p> : null}
      </div>
      <div>
        <div className="text-[12px] text-mute">{t('settings.env')}</div>
        <p className="mt-1 text-[11.5px] text-faint">{t('settings.envHint')}</p>
        <div className="mt-2 overflow-hidden rounded-xl border border-line">
          {preview.map((row) => (
            <div key={row.key} className="flex items-center justify-between border-b border-line/80 px-3 py-1.5 font-mono text-[11.5px] last:border-0">
              <span className="text-mute">{row.key}</span>
              <span className={row.secret ? 'text-faint' : 'text-ink'}>{row.value}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 font-mono text-[11px] text-faint">{modelsEndpoint(settings.baseUrl)}</p>
      </div>
    </div>
  )
}

function AgentsSection() {
  const { t } = useTranslation()
  const agents = useStudio((s) => s.settings.agents)
  const patchSettings = useStudio((s) => s.patchSettings)
  return (
    <div className="space-y-3">
      {agents.map((agent) => (
        <article key={agent.id} className="rounded-xl border border-line bg-black/20 p-3">
          <div className="flex items-center justify-between">
            <div className="text-[13px] font-medium">{agent.name}</div>
            {agent.builtin ? <span className="text-[11px] text-ok">{t('settings.builtin')}</span> : null}
          </div>
          <p className="mt-1 text-[12px] text-faint">{agent.builtin ? 'agents/dist/mock-acp-agent.mjs' : t('settings.commandHint')}</p>
          {agent.builtin ? null : (
            <TextInput
              className="mt-2 font-mono"
              value={agent.command}
              spellCheck={false}
              onChange={(event) =>
                patchSettings({
                  agents: agents.map((item) => (item.id === agent.id ? { ...item, command: event.target.value } : item)),
                })
              }
            />
          )}
        </article>
      ))}
    </div>
  )
}

function ProjectSection() {
  const { t } = useTranslation()
  const projects = useStudio((s) => s.projects)
  const activeId = useStudio((s) => s.activeProjectId)
  const patchProject = useStudio((s) => s.patchProject)
  const addProject = useStudio((s) => s.addProject)
  const set = useStudio((s) => s.set)
  const project = projects.find((item) => item.id === activeId) ?? projects[0]
  if (!project) {
    return <p className="text-[13.5px] text-mute">{t('ade.noProject')}</p>
  }
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex gap-2">
        {projects.map((item) => (
          <button key={item.id} type="button" onClick={() => set({ activeProjectId: item.id })} className={cn('rounded-lg border px-3 py-1.5 text-[12.5px]', item.id === project.id ? 'border-white/20 bg-white/8' : 'border-line text-mute')}>
            {item.name}
          </button>
        ))}
      </div>
      <Field label={t('settings.projectName')}>
        <TextInput value={project.name} onChange={(event) => patchProject(project.id, { name: event.target.value })} />
      </Field>
      <Field label={t('settings.module')}>
        <TextInput data-testid="project-module" value={project.module} onChange={(event) => patchProject(project.id, { module: event.target.value })} spellCheck={false} className="font-mono" />
      </Field>
      <Field label={t('settings.version')}>
        <div className="grid grid-cols-2 gap-2">
          {(['4.x', '5.x'] as const).map((version) => (
            <button key={version} type="button" onClick={() => patchProject(project.id, { version })} className={cn('rounded-xl border px-3 py-3 text-left', project.version === version ? 'border-ok/40 bg-ok/8' : 'border-line')}>
              <div className="font-mono text-[13px]">NukeViet {version}</div>
              <div className="mt-1 text-[11.5px] text-mute">{version === '5.x' ? 'src/ · Smarty · $nv_Lang' : 'root · XTemplate · $lang_module'}</div>
            </button>
          ))}
        </div>
      </Field>
      <Field label={t('settings.path')} hint={t('settings.pathHint')}>
        <TextInput value={project.path} onChange={(event) => patchProject(project.id, { path: event.target.value })} spellCheck={false} className="font-mono" />
      </Field>
      <button
        type="button"
        onClick={() =>
          addProject({
            id: uid('prj'),
            name: 'Module mới',
            module: 'sample',
            version: '5.x',
            path: '/projects/nukeviet/src/modules/sample',
          })
        }
        className="rounded-lg border border-line px-3 py-1.5 text-[12.5px]"
      >
        {t('settings.addProject')}
      </button>
    </div>
  )
}

function LanguageSection() {
  const { t } = useTranslation()
  const lang = useStudio((s) => s.settings.lang)
  return (
    <div className="mx-auto max-w-xl">
      <p className="mb-3 text-[12.5px] text-mute">{t('settings.langHint')}</p>
      <div className="grid grid-cols-2 gap-2">
        {(['vi', 'en'] as Lang[]).map((item) => (
          <button key={item} type="button" onClick={() => setLanguage(item)} className={cn('rounded-xl border px-4 py-4 text-left', lang === item ? 'border-white/25 bg-white/6' : 'border-line')}>
            <div className="text-[14px]">{t(`settings.${item}`)}</div>
            <div className="mt-1 font-mono text-[11px] text-faint">{item}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

function envPreview(settings: Settings, hasKey: boolean): { key: string; value: string; secret: boolean }[] {
  const rows = redactEnv(providerEnv(settings, hasKey ? 'set' : undefined))
  const placeholders: { key: string; value: string; secret: boolean }[] = []
  if (!hasKey && settings.gateway !== 'openai') placeholders.push({ key: 'ANTHROPIC_AUTH_TOKEN', value: 'chưa lưu', secret: true })
  if (!hasKey && settings.gateway !== 'anthropic') placeholders.push({ key: 'OPENAI_API_KEY', value: 'chưa lưu', secret: true })
  const plain = rows.filter((row) => !row.secret)
  const secrets = hasKey ? rows.filter((row) => row.secret) : placeholders
  const urls = plain.filter((row) => row.key.endsWith('_URL'))
  const models = plain.filter((row) => !row.key.endsWith('_URL'))
  return [...urls, ...secrets, ...models]
}

function secretHint(t: (key: string) => string, saved: boolean, storage: string | null): string {
  if (!saved) return t('settings.noKey')
  if (storage === 'safeStorage') return t('settings.savedSafe')
  if (storage === 'aes') return t('settings.savedAes')
  return t('settings.savedMemory')
}

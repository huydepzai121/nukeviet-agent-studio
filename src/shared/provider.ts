import type { GatewayMode, Settings } from './types'

const SECRET = /KEY|TOKEN|SECRET|PASSWORD/i

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '')
}

export function modelsEndpoint(baseUrl: string): string {
  const base = normalizeBaseUrl(baseUrl)
  if (/\/v1$/i.test(base)) return `${base}/models`
  return `${base}/v1/models`
}

export function providerEnv(settings: Pick<Settings, 'gateway' | 'baseUrl' | 'model'>, apiKey?: string): Record<string, string> {
  const env: Record<string, string> = {}
  const base = normalizeBaseUrl(settings.baseUrl)
  const anthropic = settings.gateway === 'anthropic' || settings.gateway === 'both'
  const openai = settings.gateway === 'openai' || settings.gateway === 'both'
  if (anthropic) {
    env.ANTHROPIC_BASE_URL = base
    env.ANTHROPIC_MODEL = settings.model
    if (apiKey) {
      env.ANTHROPIC_AUTH_TOKEN = apiKey
      env.ANTHROPIC_API_KEY = apiKey
    }
  }
  if (openai) {
    env.OPENAI_BASE_URL = base
    env.OPENAI_MODEL = settings.model
    if (apiKey) env.OPENAI_API_KEY = apiKey
  }
  return env
}

export function redactEnv(env: Record<string, string>): { key: string; value: string; secret: boolean }[] {
  return Object.entries(env).map(([key, value]) => ({
    key,
    secret: SECRET.test(key),
    value: SECRET.test(key) ? '••••••••' : value,
  }))
}

export function splitCommand(input: string): { command: string; args: string[] } {
  const parts = input.match(/"[^"]*"|'[^']*'|\S+/g)?.map((part) => part.replace(/^['"]|['"]$/g, '')) ?? []
  return { command: parts[0] ?? '', args: parts.slice(1) }
}

export function gatewayLabel(mode: GatewayMode): string {
  if (mode === 'openai') return 'OpenAI-compatible'
  if (mode === 'anthropic') return 'Anthropic-compatible'
  return 'OpenAI + Anthropic'
}

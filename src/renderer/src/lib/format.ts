export function uid(prefix = 'id'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function relativeTime(at: number, lang: 'vi' | 'en', now = Date.now()): string {
  const delta = now - at
  if (!Number.isFinite(delta) || delta < 45_000) return lang === 'vi' ? 'vừa xong' : 'just now'
  const minutes = Math.round(delta / 60_000)
  if (minutes < 60) return lang === 'vi' ? `${minutes} phút trước` : `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return lang === 'vi' ? `${hours} giờ trước` : `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days <= 1) return lang === 'vi' ? 'hôm qua' : 'yesterday'
  if (days < 14) return lang === 'vi' ? `${days} ngày trước` : `${days}d ago`
  return new Date(at).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-CA')
}

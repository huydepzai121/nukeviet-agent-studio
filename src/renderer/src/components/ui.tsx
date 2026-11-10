import { clsx, type ClassValue } from 'clsx'
import { useEffect, useRef, useState, type ReactNode } from 'react'

export function cn(...values: ClassValue[]): string {
  return clsx(values)
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="block">
      <span className="mb-1.5 block text-[12px] text-mute">{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-[11.5px] leading-relaxed text-faint">{hint}</span> : null}
    </div>
  )
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'h-9 w-full rounded-lg border border-line bg-black/25 px-3 text-[13px] outline-none transition placeholder:text-faint focus:border-white/25',
        props.className,
      )}
    />
  )
}

export function IconButton({
  label,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className={cn(
        'grid h-7 w-7 place-items-center rounded-md text-mute transition hover:bg-white/6 hover:text-ink',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function Pill({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  tone?: 'neutral' | 'ok' | 'bad' | 'warn' | 'info'
  className?: string
}) {
  const tones = {
    neutral: 'bg-white/6 text-mute',
    ok: 'bg-ok/12 text-ok',
    bad: 'bg-bad/12 text-bad',
    warn: 'bg-warn/12 text-warn',
    info: 'bg-info/12 text-info',
  }
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', tones[tone], className)}>{children}</span>
}

export function Menu({
  label,
  value,
  items,
  onChange,
  align = 'left',
}: {
  label: string
  value: string
  items: { id: string; label: string; hint?: string }[]
  onChange: (id: string) => void
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])
  const current = items.find((item) => item.id === value)
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        onClick={() => setOpen((state) => !state)}
        className="flex h-7 max-w-[180px] items-center gap-1.5 rounded-md px-2 text-[12px] text-mute transition hover:bg-white/6 hover:text-ink"
      >
        <span className="truncate">{current?.label ?? label}</span>
        <span className="text-[9px] text-faint">▾</span>
      </button>
      {open ? (
        <div className={cn('fade-up absolute bottom-full z-30 mb-1.5 min-w-[220px] rounded-xl border border-line bg-[#1a1b21] p-1 shadow-2xl', align === 'right' ? 'right-0' : 'left-0')}>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onChange(item.id)
                setOpen(false)
              }}
              className={cn('flex w-full flex-col rounded-lg px-2.5 py-1.5 text-left hover:bg-white/6', item.id === value && 'bg-white/6')}
            >
              <span className="text-[12.5px] text-ink">{item.label}</span>
              {item.hint ? <span className="text-[11px] text-faint">{item.hint}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

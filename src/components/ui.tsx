import type { ReactNode } from 'react'

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800 ${className}`} />
}

export function ErrorBox({ children, retry }: { children: ReactNode; retry?: () => void }) {
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
      <p>{children}</p>
      {retry && (
        <button type="button" onClick={retry} className="mt-2 text-xs font-medium underline">
          Reintentar
        </button>
      )}
    </div>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center dark:border-slate-800 dark:bg-slate-900/50">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{title}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

export function Chip({
  active,
  onClick,
  children,
  tone = 'neutral',
}: {
  active?: boolean
  onClick?: () => void
  children: ReactNode
  tone?: 'neutral' | 'ok' | 'warn' | 'muted' | 'accent'
}) {
  const tones = {
    neutral: active
      ? 'bg-teal-500 text-white border-teal-500'
      : 'border-slate-300 text-slate-600 hover:border-teal-400 dark:border-slate-600 dark:text-slate-300',
    ok: active
      ? 'bg-emerald-500 text-white border-emerald-500'
      : 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400',
    warn: active
      ? 'bg-amber-500 text-white border-amber-500'
      : 'border-amber-500/40 text-amber-700 dark:text-amber-400',
    muted: active
      ? 'bg-slate-500 text-white border-slate-500'
      : 'border-slate-300 text-slate-500 dark:border-slate-600',
    accent: active
      ? 'bg-violet-500 text-white border-violet-500'
      : 'border-violet-500/40 text-violet-700 dark:text-violet-300',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-all ${tones[tone]}`}
    >
      {children}
    </button>
  )
}

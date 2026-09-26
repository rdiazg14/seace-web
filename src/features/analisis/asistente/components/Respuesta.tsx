/** Piezas visuales de una respuesta del asistente: progreso, razonamiento, escenario y estadísticas. */

import { useEffect, useRef, useState } from 'react'
import { Brain, Check, ChevronRight, CircleCheckBig, CircleGauge, Clock3, Copy, Flag, Layers, Loader2 } from 'lucide-react'
import { ChatChart } from '../../../../components/ChatChart'
import { ChatTable } from '../../../../components/ChatTable'
import { MarkdownRenderer } from '../../../../components/MarkdownRenderer'
import { soles, type ChatGrafica, type ChatTabla, type EscenarioPayload } from '../../../../lib/analisis'
import {
  ANALISIS_PHASES,
  cambioRelevante,
  costoUsd,
  fmtCostoUsd,
  graficaValida,
  hayMontosReales,
  labelModelo,
  tablaValida,
  usoTokensTotal,
  type EscenaMsg,
} from '../model'

export function AnalizandoBlock({
  phase,
  collapsed,
}: {
  phase: EscenaMsg['phase']
  collapsed: boolean
}) {
  const [open, setOpen] = useState(!collapsed)
  const hasAutoCollapsedRef = useRef(false)

  useEffect(() => {
    if (hasAutoCollapsedRef.current) return
    if (collapsed) {
      setOpen(false)
      hasAutoCollapsedRef.current = true
    }
  }, [collapsed])

  if (collapsed && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-2 flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      >
        <CircleCheckBig className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
        <span>Analizado</span>
      </button>
    )
  }

  const idx = ANALISIS_PHASES.findIndex(p => p.id === phase)

  return (
    <div className="mb-2 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-primary)]">
          {!collapsed && <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-500" />}
          {collapsed && <CircleCheckBig className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />}
          {collapsed ? 'Analizado' : 'Analizando...'}
        </span>
        {collapsed && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            Ocultar
          </button>
        )}
      </div>
      <ul className="mt-1.5 space-y-0.5 text-[11px] text-[var(--text-secondary)]">
        {ANALISIS_PHASES.map((s, si) => {
          const active = !collapsed && s.id === phase
          const doneStep = collapsed || si < idx
          return (
            <li
              key={s.id}
              className={active ? 'font-medium text-[var(--text-primary)]' : ''}
            >
              {doneStep ? '✓' : active ? '●' : '○'} {s.label}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function ChatMedia({ tabla, grafica }: { tabla: ChatTabla | null; grafica: ChatGrafica | null }) {
  const [tab, setTab] = useState<'tabla' | 'grafica'>('tabla')
  const hasT = tablaValida(tabla)
  const hasG = graficaValida(grafica)
  if (hasT && hasG) {
    return (
      <div className="mt-3">
        <div className="mb-2 flex gap-1 rounded-lg border border-[var(--border)] p-0.5">
          <button
            type="button"
            onClick={() => setTab('tabla')}
            className={`flex-1 rounded-md px-2 py-1 text-xs ${
              tab === 'tabla' ? 'bg-teal-500/15 font-medium text-teal-800 dark:text-teal-200' : 'text-[var(--text-secondary)]'
            }`}
          >
            Tabla
          </button>
          <button
            type="button"
            onClick={() => setTab('grafica')}
            className={`flex-1 rounded-md px-2 py-1 text-xs ${
              tab === 'grafica' ? 'bg-teal-500/15 font-medium text-teal-800 dark:text-teal-200' : 'text-[var(--text-secondary)]'
            }`}
          >
            Gráfica
          </button>
        </div>
        {tab === 'tabla' ? <ChatTable tabla={tabla} /> : <ChatChart grafica={grafica} />}
      </div>
    )
  }
  if (hasT) return <ChatTable tabla={tabla} />
  if (hasG) return <ChatChart grafica={grafica} />
  return null
}

export function Razonamiento({ thought, streaming }: { thought: string; streaming?: boolean }) {
  const [open, setOpen] = useState(false)
  // Durante el streaming del razonamiento se fuerza expandido; al terminar se colapsa.
  const expanded = streaming || open
  return (
    <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)]/50">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-[var(--text-secondary)]"
      >
        <Brain className="h-4 w-4 shrink-0 text-purple-500 dark:text-purple-400" />
        <span>{streaming ? 'Razonando…' : 'Razonamiento'}</span>
        {streaming && <span className="ml-1 inline-block h-3 w-1.5 animate-pulse bg-purple-500 align-middle" />}
        <ChevronRight className={`ml-auto h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>
      {expanded && (
        <div className="border-t border-[var(--border)] px-3 py-2">
          <MarkdownRenderer content={thought} className="text-xs text-[var(--text-secondary)]" />
        </div>
      )}
    </div>
  )
}

export function RespuestaStats({ m }: { m: EscenaMsg }) {
  const [copied, setCopied] = useState(false)
  const u = m.usage
  const meta = m.meta
  if (!u && !m.model && !m.requestId && !meta) return null
  const total = usoTokensTotal(u)
  const cost = costoUsd(u, m.model)

  const copyId = async () => {
    if (!m.requestId) return
    try {
      await navigator.clipboard.writeText(m.requestId)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* portapapeles no disponible */ }
  }

  const finishLabel = (fr?: string): string => {
    if (!fr) return ''
    const map: Record<string, string> = {
      STOP: 'Completado',
      MAX_TOKENS: 'Límite de tokens',
      SAFETY: 'Filtro de seguridad',
      RECITATION: 'Recitación',
      PROHIBITED_CONTENT: 'Contenido prohibido',
      SPII: 'Datos sensibles',
      OTHER: 'Otro',
    }
    return map[fr] ?? fr
  }

  const fmtLatencia = (ms?: number): string => {
    if (typeof ms !== 'number') return ''
    if (ms < 1000) return `${ms} ms`
    return `${(ms / 1000).toFixed(2)} s`
  }

  return (
    <details className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)]/50">
      <summary className="flex cursor-pointer select-none items-center gap-2 px-3 py-2 text-xs font-medium text-[var(--text-secondary)]">
        <span>Estadísticas de la respuesta</span>
        <span className="text-[10px] text-slate-400">⚡ {total.toLocaleString('es-PE')} tokens · {fmtCostoUsd(cost)}</span>
      </summary>
      <div className="space-y-1 border-t border-[var(--border)] px-3 py-2 text-xs text-[var(--text-secondary)]">
        {m.model && (
          <div className="flex justify-between gap-3">
            <span>Modelo</span>
            <span className="font-medium text-[var(--text-primary)]">{labelModelo(m.model)}</span>
          </div>
        )}
        {u && (
          <>
            <div className="flex justify-between gap-3"><span>Input tokens</span><span>{u.prompt.toLocaleString('es-PE')}</span></div>
            <div className="flex justify-between gap-3"><span>Output tokens</span><span>{u.completion.toLocaleString('es-PE')}</span></div>
            {typeof u.thoughts === 'number' && u.thoughts > 0 && (
              <div className="flex justify-between gap-3"><span>Thinking tokens</span><span>{u.thoughts.toLocaleString('es-PE')}</span></div>
            )}
            {typeof u.cached === 'number' && u.cached > 0 && (
              <div className="flex justify-between gap-3"><span>Cached input tokens</span><span>{u.cached.toLocaleString('es-PE')}</span></div>
            )}
            {typeof u.total === 'number' && u.total > 0 && (
              <div className="flex justify-between gap-3 border-t border-[var(--border)] pt-1">
                <span className="font-medium">Total tokens</span>
                <span className="font-medium text-[var(--text-primary)]">{u.total.toLocaleString('es-PE')}</span>
              </div>
            )}
          </>
        )}
        {meta && (
          <>
            {meta.thinkingLevel && (
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5"><CircleGauge className="h-3.5 w-3.5" />Nivel de razonamiento</span>
                <span className="font-medium text-[var(--text-primary)]">{meta.thinkingLevel === 'low' ? 'Bajo (low)' : meta.thinkingLevel}</span>
              </div>
            )}
            {meta.finishReason && (
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5"><Flag className="h-3.5 w-3.5" />Finalización</span>
                <span>{finishLabel(meta.finishReason)}</span>
              </div>
            )}
            {typeof meta.latencyMs === 'number' && (
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />Latencia</span>
                <span>{fmtLatencia(meta.latencyMs)}</span>
              </div>
            )}
            {meta.serviceTier && (
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5"><Layers className="h-3.5 w-3.5" />Tier de servicio</span>
                <span>{meta.serviceTier}</span>
              </div>
            )}
            {meta.modelVersion && (
              <div className="flex justify-between gap-3">
                <span>Versión del modelo</span>
                <span className="truncate font-mono text-[10px]" title={meta.modelVersion}>{meta.modelVersion}</span>
              </div>
            )}
          </>
        )}
        {m.requestId && (
          <div className="flex items-center justify-between gap-3">
            <span className="truncate font-mono text-[10px]" title={m.requestId}>req {m.requestId.slice(0, 8)}…</span>
            <button
              type="button"
              onClick={copyId}
              className="flex items-center gap-1 text-teal-600 hover:text-teal-500 dark:text-teal-400"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copiado' : 'Copiar ID'}
            </button>
          </div>
        )}
      </div>
    </details>
  )
}

export function EscenarioCard({ e }: { e: EscenarioPayload }) {
  const marco = hayMontosReales(e)
  const tabla = tablaValida(e.tabla) ? e.tabla : null
  const grafica = graficaValida(e.grafica) ? e.grafica : null
  const cambio = cambioRelevante(e.cambio_vs_analisis)
  const supuestos = marco ? (e.supuestos_aplicados || []).filter(s => String(s).trim()) : []
  const sigue = (e.sigue_sin_saberse || []).filter(s => String(s).trim())
  const nota = marco ? (e.nota || '').trim() : ''

  const body = (
    <>
      <MarkdownRenderer content={e.escenario} className="text-sm" />
      <ChatMedia tabla={tabla} grafica={grafica} />
      {e.recomendacion && (
        <div className="mt-3 rounded-lg border border-teal-500/30 bg-teal-500/10 px-3 py-2 text-sm">
          💡 {e.recomendacion}
        </div>
      )}
    </>
  )

  if (!marco) {
    return (
      <div className="min-w-0">
        {body}
        {sigue.length > 0 && (
          <p className="mt-2 text-[11px] text-slate-500">
            Sigue sin saberse: {sigue.join('; ')}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="min-w-0 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3">
      <span className="rounded-full bg-teal-500/15 px-2 py-0.5 text-[11px] font-medium text-teal-700 dark:text-teal-300">
        Escenario estimado
      </span>
      <div className="mt-2">{body}</div>
      <p className="mt-2 text-sm text-slate-800 dark:text-slate-100">
        Valor {soles(e.valor_estimado_soles)} · Costo {soles(e.costo_estimado_soles)} · Margen {soles(e.margen_estimado_soles)}
      </p>
      {supuestos.length > 0 && (
        <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
          Asumiendo: {supuestos.join('; ')}.
        </p>
      )}
      {nota && <MarkdownRenderer content={nota} className="mt-2 text-[11px] text-[var(--text-secondary)]" />}
      {(cambio || sigue.length > 0) && (
        <p className="mt-1 text-[11px] text-slate-500">
          {cambio ? `Cambió vs análisis: ${cambio}` : null}
          {sigue.length > 0 && (
            <>{cambio ? ' · ' : ''}Sigue sin saberse: {sigue.join('; ')}</>
          )}
        </p>
      )}
    </div>
  )
}

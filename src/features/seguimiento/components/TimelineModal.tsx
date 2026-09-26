import { useEffect, useState } from 'react'
import { fmtFechaHora, haceCuanto } from '../../../lib/format'
import { EmptyState, ErrorBox, Skeleton } from '../../../components/ui'
import { EtapaChip } from './Chips'
import { cargarEventos } from '../api'
import {
  ETAPA_COLOR,
  fmtChars,
  fmtNum,
  fmtUsd,
  TIPO_LABEL,
  type EventoContrato,
  type FilaContrato,
} from '../model'

/** Panel modal con el timeline completo de eventos de un contrato. */
export function TimelineModal({
  contrato,
  onClose,
}: {
  contrato: FilaContrato
  onClose: () => void
}) {
  const [eventos, setEventos] = useState<EventoContrato[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [abiertos, setAbiertos] = useState<Record<number, boolean>>({})

  useEffect(() => {
    let alive = true
    setEventos(null)
    setErr(null)
    void (async () => {
      const { data, error } = await cargarEventos(contrato.contrato_id)
      if (!alive) return
      if (error) {
        setErr(error)
        return
      }
      setEventos(data)
    })()
    return () => {
      alive = false
    }
  }, [contrato.contrato_id])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm sm:p-6">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="min-w-0">
            <h3 className="truncate text-base font-medium">
              Timeline de proceso · #{contrato.contrato_id}
            </h3>
            <p className="mt-0.5 font-mono text-xs text-slate-500">
              {contrato.nro_contratacion ?? 'sin nro'}
              {contrato.descripcion ? ` · ${contrato.descripcion.slice(0, 80)}` : ''}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {contrato.n_chunks_total} chunks · {contrato.n_embebidos_v2} embebidos ·{' '}
              {fmtUsd(contrato.costo_embed_acum)} de embedding · {contrato.n_eventos} eventos
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-2.5 py-1 text-sm dark:border-slate-700"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4">
          {err && <ErrorBox retry={() => setEventos(null)}>{err}</ErrorBox>}
          {!err && eventos === null && <Skeleton className="h-40 w-full" />}
          {eventos && eventos.length === 0 && (
            <EmptyState title="Sin eventos" hint="Este contrato aún no tiene traza en proceso_evento." />
          )}
          {eventos && eventos.length > 0 && (
            <ol className="space-y-0">
              {eventos.map((e, i) => {
                const color = ETAPA_COLOR[e.etapa] ?? '#64748B'
                const abierto = abiertos[e.id] ?? false
                const detalleEntries = e.detalle ? Object.entries(e.detalle) : []
                return (
                  <li key={e.id} className="relative flex gap-3 pb-5">
                    {i < eventos.length - 1 && (
                      <span className="absolute left-[5px] top-4 bottom-0 w-px bg-slate-200 dark:bg-slate-800" />
                    )}
                    <span
                      className="relative mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-white dark:ring-slate-900"
                      style={{ backgroundColor: color }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <EtapaChip etapa={e.etapa} />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                          {fmtFechaHora(e.created_at)}
                        </span>
                        <span className="text-xs text-slate-400">{haceCuanto(e.created_at)}</span>
                        {e.detalle?.backfill === true && (
                          <span className="rounded-full bg-slate-500/10 px-1.5 py-0.5 text-[10px] text-slate-500">
                            backfill
                          </span>
                        )}
                      </div>

                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-slate-600 dark:text-slate-400">
                        {e.n_chunks_pdf != null && <span>chunks pdf <b className="tabular-nums">{e.n_chunks_pdf}</b></span>}
                        {e.n_chunks_api != null && <span>chunks api <b className="tabular-nums">{e.n_chunks_api}</b></span>}
                        {e.chars_tdr != null && <span>chars <b className="tabular-nums">{fmtChars(e.chars_tdr)}</b></span>}
                        {e.tokens_est != null && <span>tokens <b className="tabular-nums">{fmtNum(e.tokens_est)}</b></span>}
                        {e.costo_usd != null && <span>costo <b className="tabular-nums">{fmtUsd(e.costo_usd)}</b></span>}
                        {e.chunk_version && <span>v <b>{e.chunk_version}</b></span>}
                        {e.tipo_extraccion && <span>{TIPO_LABEL[e.tipo_extraccion] ?? e.tipo_extraccion}</span>}
                      </div>

                      {e.run_id && (
                        <p className="mt-1 text-xs text-slate-400">
                          run <span className="font-mono">{e.run_id}</span>
                        </p>
                      )}

                      {detalleEntries.length > 0 && (
                        <div className="mt-1.5">
                          <button
                            onClick={() => setAbiertos((p) => ({ ...p, [e.id]: !p[e.id] }))}
                            className="text-xs font-medium text-teal-600 hover:underline dark:text-teal-400"
                          >
                            {abierto ? 'ocultar detalle' : 'ver detalle'} ({detalleEntries.length})
                          </button>
                          {abierto && (
                            <pre className="mt-1 max-h-48 overflow-auto rounded-lg bg-slate-50 p-2 text-[11px] leading-relaxed dark:bg-slate-950">
                              {JSON.stringify(e.detalle, null, 2)}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  )
}

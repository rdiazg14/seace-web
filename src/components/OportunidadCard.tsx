import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Oportunidad } from '../lib/rutaDia'
import { nivelLabel } from '../lib/rutaDia'
import { cierraEn, fmtFecha, nroContrato, seaceUrl, tituloContrato } from '../lib/format'
import { CierraPill, EstadoPill, ItPill, ObjetoPill } from './Pills'

function NivelPill({ nivel }: { nivel: Oportunidad['nivel'] }) {
  const label = nivelLabel(nivel)
  const cls =
    nivel === 'nucleo'
      ? 'bg-teal-500/15 text-teal-700 dark:text-teal-300'
      : nivel === 'adyacente'
        ? 'bg-violet-500/15 text-violet-700 dark:text-violet-300'
        : nivel === 'oportunista'
          ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
          : nivel === 'marginal'
            ? 'bg-slate-500/15 text-slate-600 dark:text-slate-400'
            : 'bg-slate-500/15 text-slate-500'
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{label}</span>
}

function Veredicto({ o }: { o: Oportunidad }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {o.urgente && (
        <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:text-red-400">
          ⚡ Urgente
        </span>
      )}
      {o.veredicto === 'recomendado' ? (
        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
          Recomendado
        </span>
      ) : (
        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-300">
          Evaluar
        </span>
      )}
    </div>
  )
}

export default function OportunidadCard({
  o,
  rank,
  compact = false,
}: {
  o: Oportunidad
  rank: number
  compact?: boolean
}) {
  const c = o.contrato
  const cierre = cierraEn(c.fecha_fin_cotizacion)
  const titulo = tituloContrato(c)
  const cerradoEval = c.estado === 'En Evaluación'
  const [abriendoAnalisis, setAbriendoAnalisis] = useState(false)
  const analisisNavLock = useRef(false)

  return (
    <article
      className={`rounded-xl border bg-[var(--bg-card)] p-3.5 shadow-sm ${
        cerradoEval
          ? 'border-amber-500/40 dark:border-amber-500/30'
          : o.urgente
            ? 'border-red-500/35 dark:border-red-500/25'
            : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 font-mono text-xs text-slate-400">#{rank}</span>
          <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-0.5 font-mono text-sm font-medium text-slate-800 dark:bg-slate-800 dark:text-slate-100">
            {o.score.total}
          </span>
          <div className="flex min-w-0 flex-wrap gap-1">
            <NivelPill nivel={o.nivel} />
            {c.categoria_it && <ItPill cat={c.categoria_it} />}
            <ObjetoPill objeto={c.objeto} />
            {cerradoEval ? (
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-300">
                Cerrado / en evaluación
              </span>
            ) : (
              <EstadoPill estado={c.estado} />
            )}
            {c.fecha_fin_cotizacion && !cerradoEval && (
              <CierraPill label={cierre.label} tone={cierre.tone} />
            )}
          </div>
        </div>
        <span className="shrink-0 font-mono text-[10px] text-slate-400">{nroContrato(c)}</span>
      </div>

      {cerradoEval && (
        <p className="mb-1.5 rounded-md bg-amber-500/10 px-2 py-1 text-[11px] text-amber-800 dark:text-amber-300">
          Ventana de cotización cerrada — inteligencia de mercado, no postulable.
        </p>
      )}

      <p className={`text-sm font-medium leading-snug text-slate-900 dark:text-slate-100 ${compact ? 'line-clamp-1' : 'line-clamp-2'}`}>
        {titulo}
      </p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{c.entidad}</p>

      {!compact && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
          {c.fecha_publica && <span>Pub. {fmtFecha(c.fecha_publica)}</span>}
          {c.fecha_fin_cotizacion && <span>Cierre {fmtFecha(c.fecha_fin_cotizacion)}</span>}
          {c.tipo_cotizacion && <span>Tipo cotiz. {c.tipo_cotizacion}</span>}
          {o.overlay === 'telemetria' && <span className="text-teal-600 dark:text-teal-400">Overlay telemetría/OT</span>}
          {o.overlay === 'integracion' && <span className="text-violet-600 dark:text-violet-300">Overlay integración</span>}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <Veredicto o={o} />
        <div className="flex flex-wrap gap-2">
          <a
            href={seaceUrl(c.id)}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-teal-500 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-teal-400"
          >
            Ver en SEACE
          </a>
          <Link
            to={`/analisis/${c.id}`}
            onClick={(e) => {
              if (analisisNavLock.current) {
                e.preventDefault()
                return
              }
              analisisNavLock.current = true
              setAbriendoAnalisis(true)
            }}
            aria-disabled={abriendoAnalisis}
            className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium ${
              abriendoAnalisis
                ? 'pointer-events-none cursor-not-allowed border-slate-200 text-slate-400 dark:border-slate-700'
                : 'border-slate-200 text-slate-600 hover:border-teal-400 dark:border-slate-700 dark:text-slate-300'
            }`}
          >
            {abriendoAnalisis ? 'Abriendo…' : 'Analizar'}
          </Link>
        </div>
      </div>
    </article>
  )
}

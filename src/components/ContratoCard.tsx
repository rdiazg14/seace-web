import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Contrato } from '../types'
import { cierraEn, fmtFecha, itemsDe, nroContrato, seaceUrl, tituloContrato } from '../lib/format'
import { CierraPill, EstadoPill, CatItIaPill, ObjetoPill } from './Pills'

export default function ContratoCard({
  c,
  compact = false,
  onSimilares,
}: {
  c: Contrato
  compact?: boolean
  onSimilares?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [more, setMore] = useState(false)
  const items = itemsDe(c)
  const cierre = cierraEn(c.fecha_fin_cotizacion)
  const titulo = tituloContrato(c)

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:scale-[1.01] hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap gap-1">
          <EstadoPill estado={c.estado} />
          <ObjetoPill objeto={c.objeto} />
          <CatItIaPill categoria_it={c.categoria_it} relevancia_ia={c.relevancia_ia} />
          {c.fecha_fin_cotizacion && c.estado === 'Vigente' && (
            <CierraPill label={cierre.label} tone={cierre.tone} />
          )}
        </div>
        <span className="shrink-0 font-mono text-[10px] text-slate-400">{nroContrato(c)}</span>
      </div>

      <p className={`text-sm font-medium leading-snug text-slate-900 dark:text-slate-100 ${more ? '' : 'line-clamp-2'}`}>
        {titulo}
      </p>
      {titulo.length > 90 && (
        <button type="button" onClick={() => setMore(m => !m)} className="mt-0.5 text-[11px] text-teal-600 dark:text-teal-400">
          {more ? 'Ver menos' : 'Ver más'}
        </button>
      )}
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{c.entidad}</p>
      {c.nom_area_usuaria && (
        <p className="mt-0.5 text-[11px] text-slate-400">Área: {c.nom_area_usuaria}</p>
      )}

      {!compact && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
          {c.fecha_publica && <span>Pub. {fmtFecha(c.fecha_publica)}</span>}
          {c.fecha_fin_cotizacion && <span>Cierre {fmtFecha(c.fecha_fin_cotizacion)}</span>}
        </div>
      )}

      {items.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className="text-[11px] font-medium text-teal-600 dark:text-teal-400"
          >
            {open ? 'Ocultar' : 'Ver'} {items.length} ítem{items.length === 1 ? '' : 's'} CUBSO
          </button>
          {open && (
            <ul className="mt-1.5 space-y-1.5">
              {items.map((it, i) => (
                <li key={i} className="rounded-lg bg-slate-50 p-2 text-[11px] dark:bg-slate-800/70">
                  <p className="font-medium text-slate-700 dark:text-slate-200">
                    {it.nom_cubso || 'Ítem'} {it.cantidad != null && `· ${it.cantidad} ${it.unidad || ''}`}
                  </p>
                  {it.cod_cubso && <p className="font-mono text-slate-400">{it.cod_cubso}</p>}
                  {it.descripcion && <p className="mt-0.5 text-slate-500">{it.descripcion}</p>}
                  {it.distrito && <p className="text-slate-400">{it.distrito}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={seaceUrl(c.id)}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg bg-teal-500 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-teal-400"
        >
          Ver en SEACE
        </a>
        {onSimilares && (
          <button
            type="button"
            onClick={onSimilares}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-teal-400 dark:border-slate-700 dark:text-slate-300"
          >
            Buscar similares
          </button>
        )}
        {!onSimilares && (
          <Link
            to={`/buscar?q=${encodeURIComponent((c.categoria_it || titulo).slice(0, 60))}`}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-teal-400 dark:border-slate-700 dark:text-slate-300"
          >
            Buscar similares
          </Link>
        )}
      </div>
    </article>
  )
}

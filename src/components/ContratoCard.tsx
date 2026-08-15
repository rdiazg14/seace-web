import type { Contrato } from '../types'

const ESTADO_STYLE: Record<string, string> = {
  'Vigente': 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  'En Evaluación': 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  'Culminado': 'bg-slate-500/20 text-slate-400 border border-slate-500/30',
}

const IA_STYLE: Record<string, string> = {
  'ALTA': 'bg-red-500/20 text-red-400',
  'MEDIA': 'bg-amber-500/20 text-amber-400',
  'BAJA': 'bg-blue-500/20 text-blue-400',
}

function fmtFecha(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function ContratoCard({ c }: { c: Contrato }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 hover:border-slate-600 transition-colors">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <div className="flex flex-wrap gap-1.5">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_STYLE[c.estado] ?? 'bg-slate-700 text-slate-300'}`}>
            {c.estado}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
            {c.objeto}
          </span>
          {c.relevancia_ia && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${IA_STYLE[c.relevancia_ia]}`}>
              IA {c.relevancia_ia}
            </span>
          )}
          {c.categoria_it && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400">
              {c.categoria_it}
            </span>
          )}
        </div>
        <span className="text-xs text-slate-500 font-mono">{c.descripcion_contrato}</span>
      </div>

      <p className="text-slate-100 text-sm font-medium leading-snug mb-1 line-clamp-2">
        {c.descripcion}
      </p>
      <p className="text-slate-400 text-xs mb-3">{c.entidad}</p>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        {c.fecha_publica && (
          <span>Publicado: <span className="text-slate-400">{fmtFecha(c.fecha_publica)}</span></span>
        )}
        {c.fecha_fin_cotizacion && (
          <span>Cierre: <span className="text-slate-400">{fmtFecha(c.fecha_fin_cotizacion)}</span></span>
        )}
        {c.tipo_cotizacion && (
          <span>Tipo: <span className="text-slate-400">{c.tipo_cotizacion}</span></span>
        )}
      </div>
    </div>
  )
}

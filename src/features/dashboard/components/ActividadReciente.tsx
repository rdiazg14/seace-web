import { Link } from 'react-router-dom'
import { haceCuanto, nroContrato, tituloContrato } from '../../../lib/format'
import { EstadoPill, ObjetoPill } from '../../../components/Pills'
import type { Contrato } from '../../../types'

export function ActividadReciente({ recientes }: { recientes: Contrato[] }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-200">Actividad reciente</h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {recientes.map((c) => (
          <Link key={c.id} to={`/buscar?q=${encodeURIComponent(nroContrato(c))}`} className="rounded-xl border border-slate-200 bg-white p-3 transition hover:border-teal-400 dark:border-slate-800 dark:bg-slate-900">
            <p className="line-clamp-2 text-sm font-medium">{tituloContrato(c)}</p>
            <p className="text-xs text-slate-500">{c.entidad}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              <ObjetoPill objeto={c.objeto} />
              <EstadoPill estado={c.estado} />
              <span className="text-[11px] text-slate-400">{haceCuanto(c.fecha_publica)}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

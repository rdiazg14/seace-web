import type { Dispatch, SetStateAction } from 'react'
import { IT_CHIPS } from '../../../lib/cats'
import { cierraEn, seaceUrl, tituloContrato } from '../../../lib/format'
import { nivelLabel } from '../../rutadia/model'
import { EmptyState } from '../../../components/ui'
import { CierraPill, ItPill, ObjetoPill } from '../../../components/Pills'
import type { ContratoEstado, UrgFilter, VistaLista } from '../model'

export function TabOportunidades({
  vista,
  setVista,
  catChip,
  setCatChip,
  urg,
  setUrg,
  listaOpp,
}: {
  vista: VistaLista
  setVista: (v: VistaLista) => void
  catChip: string | null
  setCatChip: Dispatch<SetStateAction<string | null>>
  urg: UrgFilter
  setUrg: (u: UrgFilter) => void
  listaOpp: ContratoEstado[]
}) {
  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setVista('postulable')}
          className={`rounded-full px-3 py-1 text-xs ${vista === 'postulable' ? 'bg-teal-500 text-white' : 'border border-slate-300 dark:border-slate-600'}`}
        >
          Postulables
        </button>
        <button
          type="button"
          onClick={() => setVista('cerrados')}
          className={`rounded-full px-3 py-1 text-xs ${vista === 'cerrados' ? 'bg-slate-600 text-white' : 'border border-slate-300 dark:border-slate-600'}`}
        >
          En evaluación / vencidos
        </button>
      </div>
      <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1">
        <button
          type="button"
          onClick={() => setCatChip(null)}
          className={`shrink-0 rounded-full px-3 py-1 text-xs ${!catChip ? 'bg-teal-500 text-white' : 'border border-slate-300 dark:border-slate-600'}`}
        >
          Todas
        </button>
        {IT_CHIPS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCatChip((x) => x === c.id ? null : c.id)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs ${catChip === c.id ? 'bg-violet-500 text-white' : 'border border-slate-300 dark:border-slate-600'}`}
          >
            {c.label}
          </button>
        ))}
      </div>
      {vista === 'postulable' && (
        <div className="flex gap-1.5">
          {([
            ['todos', 'Todos'],
            ['hoy', 'Hoy / mañana'],
            ['semana', 'Esta semana'],
            ['mes', 'Este mes'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setUrg(id)}
              className={`rounded-full px-3 py-1 text-xs ${urg === id ? 'bg-teal-500 text-white' : 'border border-slate-300 dark:border-slate-600'}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {listaOpp.length === 0 ? (
        <EmptyState title="Sin oportunidades con esos filtros" hint="Prueba otra categoría, rango o el chip de cerrados." />
      ) : (
        <div className="space-y-2">
          {listaOpp.slice(0, 40).map((c) => {
            const u = cierraEn(c.fecha_fin_cotizacion)
            const cerrado = !c.es_postulable
            return (
              <div key={c.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium">{tituloContrato(c)}</p>
                  <p className="text-xs text-slate-500">{c.entidad}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {c.categoria_it && <ItPill cat={c.categoria_it} />}
                    {c.rubro && (
                      <span className="rounded-full bg-slate-500/15 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                        {nivelLabel(c.rubro)}
                      </span>
                    )}
                    <ObjetoPill objeto={c.objeto} />
                    {cerrado ? (
                      <span className="rounded-full bg-slate-500/20 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                        {c.es_en_evaluacion ? 'En evaluación' : 'Cerrado'}
                      </span>
                    ) : (
                      <CierraPill label={u.label} tone={u.tone} />
                    )}
                  </div>
                </div>
                <a href={seaceUrl(c.id)} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-medium text-teal-600 dark:text-teal-400">
                  Ver en SEACE
                </a>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

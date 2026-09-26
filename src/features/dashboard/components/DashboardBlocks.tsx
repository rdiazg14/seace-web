import type { ReactNode } from 'react'
import { seaceUrl, tituloContrato, cierraEn, fmtFechaLarga } from '../../../lib/format'
import { ItPill, CierraPill } from '../../../components/Pills'
import { nivelLabel } from '../../rutadia/model'
import {
  fmtTasa,
  RUBRO_LABEL,
  type ContratoEstado,
  type KpisConversion,
  type KpisConversionRubro,
  type KpisDashboard,
  type KpisNegocio,
} from '../model'

export function BriefDiario({
  kpis,
  negocio,
  top,
  tendencia,
}: {
  kpis: KpisDashboard
  negocio: KpisNegocio
  top: ContratoEstado[]
  tendencia: number
}) {
  const partes: string[] = []
  if (kpis.cierran_hoy > 0) partes.push(`cierran hoy ${kpis.cierran_hoy}`)
  if (kpis.cierran_manana > 0) partes.push(`cierran mañana ${kpis.cierran_manana}`)
  if (kpis.cierran_semana > 0) partes.push(`cierran en 2–7 días ${kpis.cierran_semana}`)
  return (
    <section className="rounded-xl border border-teal-500/30 bg-gradient-to-br from-teal-500/5 via-transparent to-emerald-500/5 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Brief del día</h2>
        <span className="text-xs capitalize text-slate-400">{fmtFechaLarga()}</span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
        Hoy hay <strong>{kpis.total_postulables}</strong> postulables,{' '}
        <strong>{negocio.nucleo_postulables}</strong> de rubro núcleo
        {partes.length > 0 && <> · {partes.join(' · ')}</>}
        {'. '}Nuevos hoy: <strong>{kpis.nuevos_hoy_postulables}</strong>. Altas IT 7d:{' '}
        <strong>{tendencia > 0 ? '+' : ''}{tendencia}%</strong>.
      </p>
      {top.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-200/60 dark:divide-slate-800/60">
          {top.map((c) => {
            const u = cierraEn(c.fecha_fin_cotizacion)
            return (
              <li key={c.id} className="flex items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <a
                    href={seaceUrl(c.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="line-clamp-1 text-sm font-medium hover:text-teal-600 dark:hover:text-teal-400"
                  >
                    {tituloContrato(c)}
                  </a>
                  <p className="truncate text-[11px] text-slate-500">{c.entidad}</p>
                </div>
                {c.categoria_it && <ItPill cat={c.categoria_it} />}
                {c.rubro && (
                  <span className="shrink-0 rounded-full bg-slate-500/15 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                    {nivelLabel(c.rubro)}
                  </span>
                )}
                <CierraPill label={u.label} tone={u.tone} />
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export function Kpi({ label, value, hint, up }: { label: string; value: string; hint: string; up?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-medium ${up === false ? 'text-red-500' : up === true ? 'text-emerald-500' : ''}`}>{value}</p>
      <p className="text-[11px] text-slate-400">{hint}</p>
    </div>
  )
}

export function ConversionBlock({
  data,
}: {
  data: { global: KpisConversion; rubros: KpisConversionRubro[] } | null
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-medium text-slate-800 dark:text-slate-200">Conversión (últimos 30 días)</h2>
        <p className="text-[11px] text-slate-400">
          Dos denominadores distintos: cobertura = radar IT publicado; ejecución = postulables (Ruta del día).
        </p>
      </div>
      {!data ? (
        <p className="text-xs text-slate-500">Sin datos de conversión todavía.</p>
      ) : (
        <>
          <div>
            <p className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-300">Cobertura</p>
            <p className="mb-2 text-[11px] text-slate-400">
              Denominador: IT publicado en 30 días (cualquier estado). ¿Cuánto del radar se tocó?
            </p>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi
                label="Rankeados 30d"
                value={data.global.rankeados_30d.toLocaleString('es-PE')}
                hint="universo IT publicado"
              />
              <Kpi label="Cob. análisis" value={fmtTasa(data.global.cob_analisis)} hint="analizados / rankeados" />
              <Kpi label="Cob. cotización" value={fmtTasa(data.global.cob_cotizacion)} hint="cotizados / analizados" />
              <Kpi label="Cob. global" value={fmtTasa(data.global.cob_global)} hint="cotizados / rankeados" />
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-300">Ejecución</p>
            <p className="mb-2 text-[11px] text-slate-400">
              Denominador: postulables (Vigente + ventana abierta, día Lima). ¿Cuánto de lo accionable se trabajó?
            </p>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi
                label="Postulables 30d"
                value={data.global.postulables_30d.toLocaleString('es-PE')}
                hint="subconjunto accionable del radar"
              />
              <Kpi label="Eje. análisis" value={fmtTasa(data.global.eje_analisis)} hint="analizados postulables / postulables" />
              <Kpi label="Eje. cotización" value={fmtTasa(data.global.eje_cotizacion)} hint="cotizados postulables / analizados postulables" />
              <Kpi label="Eje. global" value={fmtTasa(data.global.eje_global)} hint="cotizados postulables / postulables" />
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900">
                <tr>
                  <th className="px-3 py-2 font-medium">Rubro</th>
                  <th className="px-3 py-2 font-medium">Rankeados</th>
                  <th className="px-3 py-2 font-medium">Postulables</th>
                  <th className="px-3 py-2 font-medium">Cob. análisis</th>
                  <th className="px-3 py-2 font-medium">Eje. análisis</th>
                  <th className="px-3 py-2 font-medium">Cob. global</th>
                  <th className="px-3 py-2 font-medium">Eje. global</th>
                  <th className="px-3 py-2 font-medium">Eje. cotización</th>
                </tr>
              </thead>
              <tbody>
                {data.rubros.map((r) => (
                  <tr key={r.rubro} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-3 py-2 font-medium">{RUBRO_LABEL[r.rubro]}</td>
                    <td className="px-3 py-2">{r.rankeados_30d.toLocaleString('es-PE')}</td>
                    <td className="px-3 py-2">{r.postulables_30d.toLocaleString('es-PE')}</td>
                    <td className="px-3 py-2">{fmtTasa(r.cob_analisis)}</td>
                    <td className="px-3 py-2">{fmtTasa(r.eje_analisis)}</td>
                    <td className="px-3 py-2">{fmtTasa(r.cob_global)}</td>
                    <td className="px-3 py-2">{fmtTasa(r.eje_global)}</td>
                    <td className="px-3 py-2">{fmtTasa(r.eje_cotizacion)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}

export function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <p className="mb-2 text-sm font-medium">{title}</p>
      {children}
    </div>
  )
}

export function UrgCard({
  tone,
  title,
  items,
  hint,
}: {
  tone: 'hoy' | 'manana' | 'semana'
  title: string
  items: ContratoEstado[]
  hint?: string
}) {
  const wrap =
    tone === 'hoy'
      ? 'border-red-500/40 bg-red-500/10'
      : tone === 'manana'
        ? 'border-amber-500/40 bg-amber-500/10'
        : 'border-emerald-500/40 bg-emerald-500/10'
  return (
    <div className={`rounded-xl border p-3 ${wrap}`}>
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-lg font-medium">{items.length}</p>
      </div>
      {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500">Ninguno</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {items.slice(0, 3).map((c) => (
            <li key={c.id}>
              <a href={seaceUrl(c.id)} target="_blank" rel="noreferrer" className="block">
                <p className="line-clamp-1 text-xs font-medium">{tituloContrato(c)}</p>
                <p className="truncate text-[11px] text-slate-500">{c.entidad}</p>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function Spark({ values }: { values: number[] }) {
  const w = 80
  const h = 22
  const max = Math.max(...values, 1)
  const pts = values.map((v, i) => {
    const x = values.length <= 1 ? 0 : (i / (values.length - 1)) * w
    const y = h - (v / max) * (h - 2) - 1
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={w} height={h} className="text-teal-500">
      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={pts} />
    </svg>
  )
}

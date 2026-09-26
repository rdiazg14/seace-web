/** Bloques visuales del análisis: requisitos, entregables, riesgos, condiciones y veredicto. */

import {
  labelVeredicto,
  type ClausulaCritica,
  type EntregableContractual,
  type RequisitosProveedor,
  type RiesgosContractuales,
  type TonoCond,
} from '../../../lib/analisis'

function tonoCls(t: TonoCond): string {
  if (t === 'ok') return 'border-emerald-500/40 bg-emerald-500/10'
  if (t === 'bad') return 'border-red-500/40 bg-red-500/10'
  return 'border-amber-500/40 bg-amber-500/10'
}

function riesgoCls(r: 'alto' | 'medio' | 'bajo'): string {
  if (r === 'alto') return 'bg-red-500/15 text-red-700 dark:text-red-300'
  if (r === 'medio') return 'bg-amber-500/15 text-amber-800 dark:text-amber-200'
  return 'bg-slate-500/15 text-slate-600 dark:text-slate-300'
}

function impactoBorder(r: 'alto' | 'medio' | 'bajo'): string {
  if (r === 'alto') return 'border-red-500/40 bg-red-500/10'
  if (r === 'medio') return 'border-amber-500/40 bg-amber-500/10'
  return 'border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900'
}

function labelPlazoRef(r?: EntregableContractual['plazo_referencia']): string {
  if (r === 'desde_notificacion') return 'Desde notificación'
  if (r === 'desde_conclusion') return 'Desde conclusión'
  if (r === 'otro') return 'Otro'
  return '—'
}

export function RequisitosBlock({ r }: { r: RequisitosProveedor }) {
  const consorcio = r.admite_consorcio
  const certs = r.certificaciones_especificas
  return (
    <div className="mt-3 border-t border-[var(--border)] pt-3">
      <p className="text-[11px] text-[var(--text-secondary)]">Requisitos del proveedor</p>
      {(r.habilitaciones?.length ?? 0) > 0 && (
        <ul className="mt-1 space-y-0.5 text-[12px] text-[var(--text-secondary)]">
          {r.habilitaciones!.map((h, i) => <li key={i}>✅ {h}</li>)}
        </ul>
      )}
      {r.experiencia_minima && (
        <p className="mt-1 text-[12px] text-[var(--text-secondary)]">✅ {r.experiencia_minima}</p>
      )}
      {Array.isArray(certs) && certs.length === 0 && (
        <span className="mt-2 inline-block rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
          Sin certificaciones específicas requeridas
        </span>
      )}
      {(certs?.length ?? 0) > 0 && (
        <ul className="mt-1 list-disc pl-4 text-[12px] text-[var(--text-secondary)]">
          {certs!.map((c, i) => <li key={i}>{c}</li>)}
        </ul>
      )}
      <p className="mt-2 text-[11px]">
        {consorcio === true && (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-medium text-emerald-700 dark:text-emerald-300">✓ Consorcio: Sí</span>
        )}
        {consorcio === false && (
          <span className="rounded-full bg-red-500/15 px-2 py-0.5 font-medium text-red-700 dark:text-red-300">✕ Consorcio: No</span>
        )}
        {consorcio == null && (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-medium text-amber-800 dark:text-amber-200">⚠ Consorcio: no consta en TDR — verificar en bases</span>
        )}
      </p>
    </div>
  )
}

export function EntregablesTable({ items }: { items: EntregableContractual[] }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-medium text-[var(--text-primary)]">Entregables</h2>
      <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
        <table className="w-full min-w-[520px] text-left text-[12px]">
          <thead className="bg-[var(--bg-secondary)] text-[11px] text-[var(--text-secondary)]">
            <tr>
              <th className="px-3 py-2 font-medium">Entregable</th>
              <th className="px-3 py-2 font-medium">Plazo</th>
              <th className="px-3 py-2 font-medium">Referencia</th>
              <th className="px-3 py-2 font-medium">Riesgo</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e, i) => (
              <tr key={`${e.nombre}-${i}`} className="border-t border-[var(--border)]">
                <td className="px-3 py-2">
                  <p className="font-medium text-[var(--text-primary)]">{e.nombre}</p>
                  {e.descripcion && <p className="mt-0.5 text-[var(--text-secondary)]">{e.descripcion}</p>}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {e.plazo_dias != null ? `${e.plazo_dias} días` : '—'}
                </td>
                <td className="px-3 py-2">{labelPlazoRef(e.plazo_referencia)}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${riesgoCls(e.riesgo_penalidad)}`}>
                    {e.riesgo_penalidad}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function RiesgosBlock({ r }: { r: RiesgosContractuales }) {
  const criticas: ClausulaCritica[] = r.clausulas_criticas || []
  return (
    <section>
      <h2 className="mb-2 text-sm font-medium text-[var(--text-primary)]">Riesgos contractuales</h2>
      <div className="mb-3 flex flex-wrap gap-2 text-[11px]">
        {r.propiedad_materiales && (
          <span className="rounded-full border border-[var(--border)] px-2 py-0.5">
            Propiedad materiales: {r.propiedad_materiales}
          </span>
        )}
        {r.plataforma_provee && (
          <span className="rounded-full border border-[var(--border)] px-2 py-0.5">
            Plataforma: {r.plataforma_provee}
          </span>
        )}
        {r.penalidad_factor_f != null && (
          <span className="rounded-full border border-[var(--border)] px-2 py-0.5">
            F = {r.penalidad_factor_f}
          </span>
        )}
        {r.penalidad_tope_pct != null && (
          <span className="rounded-full border border-[var(--border)] px-2 py-0.5">
            Tope {r.penalidad_tope_pct}%
          </span>
        )}
      </div>
      {r.penalidad_formula && (
        <p className="mb-3 text-[12px] text-[var(--text-secondary)]">{r.penalidad_formula}</p>
      )}
      {criticas.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {criticas.map((c, i) => (
            <div key={`${c.clausula}-${i}`} className={`rounded-xl border p-3 ${impactoBorder(c.impacto)}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{c.clausula}</p>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${riesgoCls(c.impacto)}`}>
                  {c.impacto}
                </span>
              </div>
              <p className="mt-1 text-[12px] text-[var(--text-secondary)]">{c.descripcion}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export function CondCard({
  title,
  value,
  detail,
  tono,
}: {
  title: string
  value: string
  detail?: string
  tono: TonoCond
}) {
  const extra = detail?.trim()
  const extraCls = tono === 'bad'
    ? 'text-red-700 dark:text-red-300'
    : tono === 'warn'
      ? 'text-amber-800 dark:text-amber-200'
      : 'text-[var(--text-secondary)]'
  const showExtra = Boolean(extra) && (tono !== 'ok' || extra !== value)
  return (
    <div className={`rounded-xl border p-3 ${tonoCls(tono)}`}>
      <p className="text-[11px] text-[var(--text-secondary)]">{title}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
      {showExtra && extra && <p className={`mt-1 text-[11px] ${extraCls}`}>{extra}</p>}
    </div>
  )
}

export function VeredictoBanner({
  codigo,
  urgente,
  razon,
  aviso,
}: {
  codigo: 'recomendado' | 'evaluar' | 'no_recomendado'
  urgente: boolean
  razon: string
  aviso: string
}) {
  const wrap =
    codigo === 'recomendado'
      ? 'border-emerald-500/40 bg-emerald-500/10'
      : codigo === 'no_recomendado'
        ? 'border-red-500/40 bg-red-500/10'
        : 'border-amber-500/40 bg-amber-500/10'
  return (
    <div className={`rounded-xl border p-4 ${wrap}`}>
      <div className="flex flex-wrap items-center gap-2">
        {urgente && (
          <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:text-red-400">
            Urgente
          </span>
        )}
        <p className="text-base font-medium">{labelVeredicto(codigo)}</p>
      </div>
      <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{razon}</p>
      <p className="mt-2 text-[11px] text-slate-500">{aviso}</p>
    </div>
  )
}

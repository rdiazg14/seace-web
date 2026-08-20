import { useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Maximize2,
  Mic,
  Monitor,
  Package,
  Smartphone,
  Users,
} from 'lucide-react'
import { Modal } from './Modal'
import {
  labelCalifica,
  labelRubro,
  rangoSoles,
  soles,
  type Alternativa,
  type AnalisisEncaje,
  type AnalisisPayload,
  type CodigoVeredicto,
  type ComponenteServicio,
  type ContradiccionTdr,
  type CotizacionComponente,
  type RatioAlcance,
} from '../lib/analisis'

function viaCls(v: Alternativa['viabilidad']): string {
  if (v === 'viable') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
  if (v === 'inviable') return 'border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-300'
  return 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200'
}

function impactoCls(r: ContradiccionTdr['impacto']): string {
  if (r === 'alto') return 'border-red-500/40 bg-red-500/10'
  if (r === 'medio') return 'border-amber-500/40 bg-amber-500/10'
  return 'border-[var(--border)] bg-[var(--bg-secondary)]'
}

function impactoBadge(r: ContradiccionTdr['impacto']): string {
  if (r === 'alto') return 'bg-red-500/15 text-red-700 dark:text-red-300'
  if (r === 'medio') return 'bg-amber-500/15 text-amber-800 dark:text-amber-200'
  return 'bg-slate-500/15 text-slate-600 dark:text-slate-300'
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-[var(--text-secondary)]">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  )
}

export function InfografiaRatio({
  ratio,
  codigo,
  encaje,
  duracion,
  descalificador,
}: {
  ratio: RatioAlcance
  codigo: CodigoVeredicto
  encaje: AnalisisEncaje
  duracion?: string | null
  descalificador?: string | null
}) {
  const [open, setOpen] = useState(false)
  const techo = ratio.techo_contrato
  const max = ratio.valor_mercado_max
  const pct = max && max > 0 ? Math.min(100, Math.round((techo / max) * 100)) : 0
  const Icon = codigo === 'recomendado' ? CheckCircle2 : codigo === 'no_recomendado' ? AlertTriangle : CircleAlert
  const iconCls = codigo === 'recomendado'
    ? 'text-emerald-500'
    : codigo === 'no_recomendado'
      ? 'text-red-500'
      : 'text-amber-500'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 text-left hover:border-teal-400"
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon className={`h-5 w-5 shrink-0 ${iconCls}`} />
            <p className="text-sm font-medium">Alcance vs techo</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]">
            <Maximize2 className="h-3 w-3" /> Expandir
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Techo" value={soles(techo)} />
          <Stat label="Mercado" value={rangoSoles(ratio.valor_mercado_min, ratio.valor_mercado_max)} />
          <Stat label="Ratio" value={ratio.ratio_texto || '—'} />
          <Stat label="Duración" value={duracion?.trim() || '—'} />
        </div>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Alcance vs techo del contrato">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Techo" value={soles(techo)} />
          <Stat label="Mercado" value={rangoSoles(ratio.valor_mercado_min, ratio.valor_mercado_max)} />
          <Stat label="Ratio" value={ratio.ratio_texto || '—'} />
          <Stat label="Duración" value={duracion?.trim() || '—'} />
        </div>
        {max != null && max > 0 && (
          <div className="mt-5">
            <p className="mb-1 text-[11px] text-[var(--text-secondary)]">
              Techo ({soles(techo)}) cubre {pct}% del mercado máx. ({soles(max)})
            </p>
            <div className="relative h-4 overflow-hidden rounded-full bg-red-500/40">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-emerald-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-[var(--text-secondary)]">
              <span>Techo</span>
              <span>Mercado</span>
            </div>
          </div>
        )}
        {ratio.lectura && (
          <p className="mt-4 text-sm text-[var(--text-secondary)]">{ratio.lectura}</p>
        )}
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {descalificador && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3">
              <p className="text-[11px] font-medium text-red-700 dark:text-red-300">Descalificador</p>
              <p className="mt-1 text-sm">{descalificador}</p>
            </div>
          )}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-3">
            <p className="text-[11px] font-medium text-[var(--text-secondary)]">Encaje</p>
            <p className="mt-1 text-sm font-medium">
              {labelRubro(encaje.rubro)} · {labelCalifica(encaje.califica)}
            </p>
            {encaje.razon && <p className="mt-1 text-[12px] text-[var(--text-secondary)]">{encaje.razon}</p>}
          </div>
        </div>
      </Modal>
    </>
  )
}

function AlternativaPanel({ alt }: { alt: Alternativa }) {
  const eco = alt.economia
  const margen = eco?.margen
  return (
    <div className={`rounded-xl border p-3 ${viaCls(alt.viabilidad)}`}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium">{alt.etiqueta} · {alt.titulo}</p>
        {alt.recomendada && (
          <span className="rounded-full bg-teal-500/20 px-2 py-0.5 text-[11px] font-medium text-teal-800 dark:text-teal-300">
            Recomendada
          </span>
        )}
      </div>
      {alt.veredicto_corto && <p className="mt-1 text-sm font-medium">{alt.veredicto_corto}</p>}
      {alt.explicacion && <p className="mt-2 text-sm opacity-90">{alt.explicacion}</p>}
      {eco && (eco.valor != null || eco.costo != null || eco.margen != null) && (
        <table className="mt-3 w-full text-[12px]">
          <tbody>
            {eco.valor != null && (
              <tr><td className="py-0.5 text-[var(--text-secondary)]">Valor</td><td className="text-right">{soles(eco.valor)}</td></tr>
            )}
            {eco.costo != null && (
              <tr><td className="py-0.5 text-[var(--text-secondary)]">Costo</td><td className="text-right">{soles(eco.costo)}</td></tr>
            )}
            {margen != null && (
              <tr>
                <td className="py-0.5 text-[var(--text-secondary)]">Margen</td>
                <td className={`text-right font-medium ${margen < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {soles(margen)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
      {eco?.nota && <p className="mt-2 text-[11px] opacity-80">{eco.nota}</p>}
      {alt.riesgo_clave && (
        <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px]">
          {alt.riesgo_clave}
        </div>
      )}
    </div>
  )
}

export function AlternativasBlock({ items }: { items: Alternativa[] }) {
  const defaultIdx = Math.max(0, items.findIndex(a => a.recomendada))
  const [tab, setTab] = useState(defaultIdx)
  if (items.length === 1) {
    return (
      <section>
        <h2 className="mb-2 text-sm font-medium">Vía de postulación</h2>
        <AlternativaPanel alt={items[0]} />
      </section>
    )
  }
  const actual = items[tab] ?? items[0]
  return (
    <section>
      <h2 className="mb-2 text-sm font-medium">Vías de postulación</h2>
      <div className="-mx-3 mb-3 flex gap-1 overflow-x-auto px-3">
        {items.map((a, i) => (
          <button
            key={`${a.etiqueta}-${i}`}
            type="button"
            onClick={() => setTab(i)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${
              i === tab
                ? 'border-teal-500 bg-teal-500 text-white'
                : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-teal-400'
            }`}
          >
            {a.etiqueta}{a.recomendada ? ' · rec.' : ''}
          </button>
        ))}
      </div>
      {actual && <AlternativaPanel alt={actual} />}
    </section>
  )
}

function iconoComponente(nombre: string) {
  const n = nombre.toLowerCase()
  if (n.includes('móvil') || n.includes('movil') || n.includes('app')) return Smartphone
  if (n.includes('web') || n.includes('dashboard') || n.includes('portal')) return Monitor
  if (/\bia\b/.test(n) || n.includes('inteligenc') || n.includes('voz') || n.includes('speech') || n.includes('nlp') || n.includes('machine')) return Mic
  if (n.includes('capacit') || n.includes('curso') || n.includes('formación') || n.includes('formacion')) return Users
  return Package
}

export function ComponentesTabs({ items }: { items: ComponenteServicio[] }) {
  const [tab, setTab] = useState(0)
  const c = items[tab] ?? items[0]
  if (!c) return null
  return (
    <section>
      <h2 className="mb-2 text-sm font-medium">Componentes del servicio</h2>
      <div className="-mx-3 mb-3 flex gap-1 overflow-x-auto px-3">
        {items.map((item, i) => {
          const Icon = iconoComponente(item.nombre)
          return (
            <button
              key={`${item.nombre}-${i}`}
              type="button"
              onClick={() => setTab(i)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${
                i === tab
                  ? 'border-teal-500 bg-teal-500 text-white'
                  : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-teal-400'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.nombre.length > 42 ? `${item.nombre.slice(0, 40)}…` : item.nombre}
            </button>
          )
        })}
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3">
        <p className="text-sm font-medium">{c.nombre}</p>
        <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
          {c.modalidad}
          {c.participantes_max != null && <> · Hasta {c.participantes_max} participantes</>}
          {c.horas_min != null && <> · {c.horas_min} h mín.</>}
          {c.sesiones_min != null && <> · {c.sesiones_min} sesiones mín.</>}
        </p>
        {(c.temario?.length ?? 0) > 0 && (
          <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[12px] text-[var(--text-secondary)]">
            {c.temario!.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        )}
      </div>
    </section>
  )
}

export function EconomiaPorComponente({
  componentes,
  techo,
  lectura,
}: {
  componentes: CotizacionComponente[]
  techo?: number | null
  lectura?: string | null
}) {
  const [open, setOpen] = useState(false)
  const sumMin = componentes.reduce((s, c) => s + (c.mercado_min ?? 0), 0)
  const sumMax = componentes.reduce((s, c) => s + (c.mercado_max ?? 0), 0)
  const excede = techo != null && sumMin > techo

  return (
    <div className="mt-3 border-t border-[var(--border)] pt-3">
      <p className="text-[11px] text-[var(--text-secondary)]">Mercado por componente</p>
      <table className="mt-1 w-full text-[12px]">
        <tbody>
          {componentes.map((c, i) => (
            <tr key={`${c.componente}-${i}`} className="border-t border-[var(--border)] first:border-0">
              <td className="py-1 pr-2">{c.componente}</td>
              <td className="whitespace-nowrap py-1 text-right">{rangoSoles(c.mercado_min, c.mercado_max)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 text-xs font-medium text-teal-600 dark:text-teal-400"
      >
        Ver detalle por componente
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Cotización de mercado por componente">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-[12px]">
            <thead className="text-[11px] text-[var(--text-secondary)]">
              <tr>
                <th className="py-2 font-medium">Componente</th>
                <th className="py-2 font-medium">Mín.</th>
                <th className="py-2 font-medium">Máx.</th>
                <th className="py-2 font-medium">Nota</th>
              </tr>
            </thead>
            <tbody>
              {componentes.map((c, i) => (
                <tr key={`${c.componente}-${i}`} className="border-t border-[var(--border)]">
                  <td className="py-2 pr-2">{c.componente}</td>
                  <td className="whitespace-nowrap py-2">{soles(c.mercado_min)}</td>
                  <td className="whitespace-nowrap py-2">{soles(c.mercado_max)}</td>
                  <td className="py-2 text-[var(--text-secondary)]">{c.nota || '—'}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-[var(--border)] font-medium">
                <td className="py-2">Total mercado</td>
                <td className="py-2">{soles(sumMin)}</td>
                <td className="py-2">{soles(sumMax)}</td>
                <td />
              </tr>
              {techo != null && (
                <tr className={excede ? 'bg-red-500/10 font-medium text-red-700 dark:text-red-300' : 'font-medium'}>
                  <td className="py-2">Techo del contrato</td>
                  <td className="py-2" colSpan={2}>{soles(techo)}</td>
                  <td className="py-2 text-[11px]">{excede ? 'El mercado mínimo excede el techo' : ''}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {lectura && (
          <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-3">
            <p className="text-[11px] font-medium text-[var(--text-secondary)]">Lectura de asesor</p>
            <p className="mt-1 text-sm">{lectura}</p>
          </div>
        )}
      </Modal>
    </div>
  )
}

export function ContradiccionesBlock({ items }: { items: ContradiccionTdr[] }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-medium">Contradicciones e inconsistencias del TDR</h2>
      <div className="space-y-2">
        {items.map((c, i) => (
          <div key={i} className={`rounded-xl border p-3 ${impactoCls(c.impacto)}`}>
            <div className="mb-1 flex justify-end">
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${impactoBadge(c.impacto)}`}>
                {c.impacto}
              </span>
            </div>
            <p className="text-sm">{c.descripcion}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export function descalificadorDe(a: AnalisisPayload): string | null {
  const altos = (a.viabilidad?.contradicciones_tdr || []).filter(c => c.impacto === 'alto')
  if (altos[0]?.descripcion) return altos[0].descripcion
  if (a.veredicto.codigo === 'no_recomendado') return a.veredicto.razonamiento || null
  return null
}

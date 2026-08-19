import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Contrato } from '../types'
import {
  addCalendarDays,
  dayOf,
  fmtFechaLarga,
  limaDateISO,
} from '../lib/format'
import {
  aplicarFiltros,
  LINEA_CHIPS,
  NIVELES,
  puntuar,
  rankingActivo,
  RUTA_DIA_COLS,
  type FiltroCierre,
  type FiltroEstado,
  type NivelRubro,
  type Oportunidad,
} from '../lib/rutaDia'
import { Chip, EmptyState, ErrorBox, Skeleton } from '../components/ui'
import OportunidadCard from '../components/OportunidadCard'

const EXPANDS = [15, 50, 100, 500, 1000] as const
const PAGE = 1000

async function fetchUniverso(): Promise<Contrato[]> {
  const out: Contrato[] = []
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from('contratos')
      .select(RUTA_DIA_COLS)
      .in('estado', ['Vigente', 'En Evaluación'])
      .or('categoria_it.not.is.null,relevancia_ia.not.is.null')
      .range(from, from + PAGE - 1)
    if (error) throw error
    const batch = (data ?? []) as unknown as Contrato[]
    out.push(...batch)
    if (batch.length < PAGE) break
    from += PAGE
    if (from >= 20000) break
  }
  return out
}

export default function RutaDia() {
  const [raw, setRaw] = useState<Contrato[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nivel, setNivel] = useState<NivelRubro | null>(null)
  const [linea, setLinea] = useState<string | null>(null)
  const [cierre, setCierre] = useState<FiltroCierre>('todos')
  const [estado, setEstado] = useState<FiltroEstado>('todos')
  const [mostrar, setMostrar] = useState(15)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const rows = await fetchUniverso()
        if (!cancelled) setRaw(rows)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudo cargar la ruta del día')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  const today = limaDateISO()
  const tomorrow = addCalendarDays(today, 1)
  const weekEnd = addCalendarDays(today, 7)

  const scored = useMemo(() => rankingActivo(raw.map(puntuar), today), [raw, today])

  const filtrado = useMemo(
    () => aplicarFiltros(scored, { nivel, linea, cierre, estado, today }),
    [scored, nivel, linea, cierre, estado, today],
  )

  const brief = useMemo(
    () => filtrado.filter(o => o.postulable).slice(0, 15),
    [filtrado],
  )

  const kpis = useMemo(() => {
    const vigentes = scored.filter(o => o.postulable)
    const nuevosHoy = raw.filter(c => dayOf(c.fecha_publica) === today).length
    let cierranHoy = 0
    let cierranManana = 0
    let cierranSemana = 0
    let nucleo = 0
    let nucleoIa = 0
    let nucleoCloud = 0
    let nucleoDev = 0
    let nucleoTel = 0
    for (const o of vigentes) {
      if (o.nivel === 'nucleo') {
        nucleo += 1
        if (o.overlay === 'telemetria') nucleoTel += 1
        if (o.contrato.categoria_it === 'IA/analytics') nucleoIa += 1
        if (o.contrato.categoria_it === 'Cloud/hosting') nucleoCloud += 1
        if (o.contrato.categoria_it === 'Desarrollo software') nucleoDev += 1
      }
      const d = dayOf(o.contrato.fecha_fin_cotizacion)
      if (!d) continue
      if (d === today) cierranHoy += 1
      else if (d === tomorrow) cierranManana += 1
      else if (d <= weekEnd) cierranSemana += 1
    }
    return { nuevosHoy, cierranHoy, cierranManana, cierranSemana, nucleo, nucleoIa, nucleoCloud, nucleoDev, nucleoTel }
  }, [scored, raw, today, tomorrow, weekEnd])

  const visible: Oportunidad[] = filtrado.slice(0, mostrar)
  const hayMas = filtrado.length > mostrar

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-3 py-5 sm:px-4">
      <header>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-xl text-slate-900 sm:text-2xl dark:text-slate-50">Ruta del día</h1>
            <p className="text-sm text-slate-500">
              Brief de oportunidades ENERTRONIC · score preliminar (sin IA)
            </p>
          </div>
          <p className="text-xs capitalize text-slate-400">{fmtFechaLarga()}</p>
        </div>
      </header>

      {error && <ErrorBox retry={() => window.location.reload()}>{error}</ErrorBox>}

      {loading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Kpi label="Nuevos hoy" value={kpis.nuevosHoy} hint="publicados 24 h" />
          <Kpi label="Cierran hoy" value={kpis.cierranHoy} hint="vigentes" warn={kpis.cierranHoy > 0} />
          <Kpi label="Cierran mañana" value={kpis.cierranManana} hint="vigentes" warn={kpis.cierranManana > 0} />
          <Kpi label="Cierran esta semana" value={kpis.cierranSemana} hint="días 2–7" />
          <Kpi
            label="Vigentes núcleo"
            value={kpis.nucleo}
            hint={`IA ${kpis.nucleoIa} · Cloud ${kpis.nucleoCloud} · Dev ${kpis.nucleoDev}${kpis.nucleoTel ? ` · Tel ${kpis.nucleoTel}` : ''}`}
          />
        </div>
      )}

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-medium text-slate-800 dark:text-slate-200">Brief del día · Top 15 vigentes</h2>
          <p className="text-[11px] text-slate-500">
            Solo postulables. «En evaluación» no entra aquí — vive en el ranking, marcado como cerrado.
          </p>
        </div>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
          </div>
        ) : brief.length === 0 ? (
          <EmptyState
            title="Sin vigentes con esos filtros"
            hint="Prueba otro rubro o rango de cierre. El brief no incluye contratos en evaluación."
          />
        ) : (
          <div className="space-y-2">
            {brief.map((o, i) => (
              <OportunidadCard key={o.contrato.id} o={o} rank={i + 1} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-medium text-slate-800 dark:text-slate-200">Ranking completo</h2>
          <p className="text-[11px] text-slate-500">
            Ordenado por score. Nada se oculta: elige cuántos ver. {filtrado.length.toLocaleString('es-PE')} en vista actual.
          </p>
        </div>

        <div className="space-y-2">
          <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1">
            <Chip active={nivel === null} onClick={() => setNivel(null)}>Todos los niveles</Chip>
            {NIVELES.map(n => (
              <Chip
                key={n.id}
                active={nivel === n.id}
                tone={n.id === 'nucleo' ? 'ok' : n.id === 'marginal' ? 'muted' : 'accent'}
                onClick={() => setNivel(x => x === n.id ? null : n.id)}
              >
                {n.stars} {n.label}
              </Chip>
            ))}
          </div>
          <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1">
            <Chip active={linea === null} onClick={() => setLinea(null)}>Todas las líneas</Chip>
            {LINEA_CHIPS.map(c => (
              <Chip
                key={c.id}
                active={linea === c.id}
                onClick={() => setLinea(x => x === c.id ? null : c.id)}
              >
                {c.label}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {([
              ['todos', 'Cierre: todos'],
              ['hoy', 'Cierran hoy'],
              ['semana', 'Esta semana'],
              ['mes', 'Este mes'],
            ] as const).map(([id, label]) => (
              <Chip key={id} active={cierre === id} onClick={() => setCierre(id)} tone={id === 'hoy' ? 'warn' : 'neutral'}>
                {label}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Chip active={estado === 'todos'} onClick={() => setEstado('todos')}>Todos los estados</Chip>
            <Chip active={estado === 'Vigente'} tone="ok" onClick={() => setEstado('Vigente')}>Vigente (postulable)</Chip>
            <Chip active={estado === 'En Evaluación'} tone="warn" onClick={() => setEstado('En Evaluación')}>
              En evaluación (cerrado)
            </Chip>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-slate-500">Mostrar</span>
          {EXPANDS.map(n => (
            <Chip key={n} active={mostrar === n} onClick={() => setMostrar(n)}>
              Top {n}
            </Chip>
          ))}
          <Chip active={mostrar >= 999999} onClick={() => setMostrar(999999)}>
            Todos
          </Chip>
        </div>

        {loading ? (
          <Skeleton className="h-40" />
        ) : visible.length === 0 ? (
          <EmptyState title="Nada en el ranking con esos filtros" hint="Los filtros navegan; no borran el resto." />
        ) : (
          <div className="space-y-2">
            {visible.map((o, i) => (
              <OportunidadCard key={o.contrato.id} o={o} rank={i + 1} compact={mostrar > 50} />
            ))}
            {hayMas && (
              <p className="text-center text-[11px] text-slate-400">
                Mostrando {visible.length.toLocaleString('es-PE')} de {filtrado.length.toLocaleString('es-PE')}. Expande para ver más.
              </p>
            )}
          </div>
        )}
      </section>

      <p className="pb-6 text-[11px] text-slate-400">
        Score = rubro 50 + vigencia 25 + urgencia 15 + señales 10. Modalidad, pago y margen llegan con el análisis IA.
        Ciberseguridad permanece oportunista (candidato a revisar si aparecen contratos fuertes).
      </p>
    </div>
  )
}

function Kpi({
  label,
  value,
  hint,
  warn,
}: {
  label: string
  value: number
  hint: string
  warn?: boolean
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-medium ${warn ? 'text-red-500' : ''}`}>{value.toLocaleString('es-PE')}</p>
      <p className="text-[11px] text-slate-400">{hint}</p>
    </div>
  )
}

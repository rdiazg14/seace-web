import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Contrato } from '../types'
import {
  addCalendarDays,
  cierraHoyInstante,
  dayOf,
  estadoActualizacion,
  estadoIngesta,
  limaDateISO,
} from '../lib/format'
import {
  ANALISIS_SCORE_SELECT,
  aplicarFiltros,
  estadoConsultas,
  LINEA_CHIPS,
  NIVELES,
  ordenarPostulables,
  puntuar,
  rankingActivo,
  resolverAnalisisParaContrato,
  RUTA_DIA_COLS,
  sliceDesdeFilaAnalisis,
  type AnalisisScoreSlice,
  type FiltroCierre,
  type NivelRubro,
} from '../lib/rutaDia'
import { Chip, EmptyState, ErrorBox, Skeleton } from '../components/ui'
import OportunidadCard from '../components/OportunidadCard'

const PAGE = 1000
const ID_CHUNK = 1000
const TAM_PAGINA_OPCIONES = [10, 20, 50, 100] as const

type AnalisisFilaScore = {
  contrato_id: number
  pdf_hash: string
  slice: AnalisisScoreSlice | null
}

async function fetchUniverso(): Promise<Contrato[]> {
  const out: Contrato[] = []
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from('v_contratos')
      .select(RUTA_DIA_COLS)
      .in('estado', ['Vigente', 'En Evaluación'])
      .or('categoria_it.not.is.null,relevancia_ia.not.is.null')
      // PostgREST: .range() sin .order() no garantiza orden entre paginas;
      // la pagina 2 puede repetir filas de la 1 y omitir otras.
      .order('id')
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

/**
 * Round-trip a analisis_contrato (chunked por límite URL).
 * Select JSON path: solo encaje/economia/condiciones/veredicto del payload.
 * Hoy hay ~17 filas; se pide por ids postulables del universo.
 * Los trozos van en paralelo (Promise.all), no secuenciales, para no
 * sumar latencia de red en cada página de la Ruta del día.
 */
async function fetchAnalisisScore(ids: number[]): Promise<AnalisisFilaScore[]> {
  if (ids.length === 0) return []
  const chunks: number[][] = []
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    chunks.push(ids.slice(i, i + ID_CHUNK))
  }
  const resultados = await Promise.all(
    chunks.map(async (chunk) => {
      const { data, error } = await supabase
        .from('analisis_contrato')
        .select(ANALISIS_SCORE_SELECT)
        .in('contrato_id', chunk)
      if (error) throw error
      return data ?? []
    }),
  )
  const out: AnalisisFilaScore[] = []
  for (const rows of resultados) {
    for (const row of rows) {
      const r = row as {
        contrato_id: number
        pdf_hash: string
        encaje?: unknown
        economia?: unknown
        condiciones?: unknown
        veredicto?: unknown
      }
      out.push({
        contrato_id: r.contrato_id,
        pdf_hash: r.pdf_hash,
        slice: sliceDesdeFilaAnalisis(r),
      })
    }
  }
  return out
}

export default function RutaDia() {
  const { session } = useAuth()
  const [raw, setRaw] = useState<Contrato[]>([])
  const [analisisFilas, setAnalisisFilas] = useState<AnalisisFilaScore[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nivel, setNivel] = useState<NivelRubro | null>(null)
  const [linea, setLinea] = useState<string | null>(null)
  const [cierre, setCierre] = useState<FiltroCierre>('todos')
  const [estadoOtras, setEstadoOtras] = useState<'por_abrir' | 'cerrados'>('cerrados')
  const [paginaPost, setPaginaPost] = useState(1)
  const [paginaOtras, setPaginaOtras] = useState(1)
  const [tamPagina, setTamPagina] = useState(10)
  const [ocultos, setOcultos] = useState<Set<number>>(new Set())
  const [mostrarOcultos, setMostrarOcultos] = useState(false)
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)
  const [actualizado, setActualizado] = useState<string | null>(null)
  const [ingesta, setIngesta] = useState<string | null>(null)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const apply = () => setFiltrosAbiertos(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function cargarActualizacion() {
      const { data, error } = await supabase
        .from('pipeline_estado')
        .select('ultima_corrida_utc, ultima_ingesta_utc')
        .limit(1)
        .maybeSingle()
      if (!cancelled && !error) {
        const fila = data as { ultima_corrida_utc: string; ultima_ingesta_utc: string | null } | null
        setActualizado(fila?.ultima_corrida_utc ?? null)
        setIngesta(fila?.ultima_ingesta_utc ?? null)
      }
    }
    void cargarActualizacion()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const rows = await fetchUniverso()
        // Ids del universo (Vigente + En Evaluación). Respuesta ≤ filas en analisis_contrato (~17).
        const analisis = await fetchAnalisisScore(rows.map(c => c.id))
        if (!cancelled) {
          setRaw(rows)
          setAnalisisFilas(analisis)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudo cargar la ruta del día')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  // Proyectos ocultos por el usuario actual.
  useEffect(() => {
    const userId = session?.user.id
    if (!userId) return
    let cancelled = false
    async function load() {
      const { data, error } = await supabase
        .from('ruta_ocultos')
        .select('contrato_id')
        .eq('user_id', userId)
      if (!cancelled && !error) {
        const ids = (data ?? []).map(r => (r as { contrato_id: number }).contrato_id)
        setOcultos(new Set(ids))
      }
    }
    void load()
    return () => { cancelled = true }
  }, [session])

  async function ocultar(id: number) {
    const userId = session?.user.id
    if (!userId) return
    setOcultos(prev => new Set(prev).add(id))
    const { error } = await supabase.from('ruta_ocultos').insert({ user_id: userId, contrato_id: id })
    if (error) {
      setOcultos(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  async function restaurar(id: number) {
    const userId = session?.user.id
    if (!userId) return
    setOcultos(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    const { error } = await supabase.from('ruta_ocultos').delete().eq('user_id', userId).eq('contrato_id', id)
    if (error) {
      setOcultos(prev => new Set(prev).add(id))
    }
  }

  function resetPaginas() {
    setPaginaPost(1)
    setPaginaOtras(1)
  }

  const today = limaDateISO()
  const tomorrow = addCalendarDays(today, 1)
  const weekEnd = addCalendarDays(today, 7)

  const scored = useMemo(
    () => rankingActivo(raw.map(c => {
      const slice = resolverAnalisisParaContrato(c, analisisFilas)
      return puntuar(c, new Date(), slice)
    })),
    [raw, analisisFilas],
  )

  // Postulables: todos, ordenados por vencimiento (hoy > mañana > semana > …) y score.
  const postulablesBase = useMemo(
    () => ordenarPostulables(aplicarFiltros(scored, { nivel, linea, cierre, estado: 'postulable' })),
    [scored, nivel, linea, cierre],
  )
  const postulablesVisibles = useMemo(
    () => postulablesBase.filter(o => !ocultos.has(o.contrato.id)),
    [postulablesBase, ocultos],
  )
  const ocultosList = useMemo(
    () => postulablesBase.filter(o => ocultos.has(o.contrato.id)),
    [postulablesBase, ocultos],
  )
  const otras = useMemo(
    () => aplicarFiltros(scored, { nivel, linea, cierre: 'todos', estado: estadoOtras }),
    [scored, nivel, linea, estadoOtras],
  )

  const totalPagPost = Math.max(1, Math.ceil(postulablesVisibles.length / tamPagina))
  const pagPost = Math.min(paginaPost, totalPagPost)
  const postPaginados = postulablesVisibles.slice((pagPost - 1) * tamPagina, pagPost * tamPagina)

  const totalPagOtras = Math.max(1, Math.ceil(otras.length / tamPagina))
  const pagOtras = Math.min(paginaOtras, totalPagOtras)
  const otrasPaginados = otras.slice((pagOtras - 1) * tamPagina, pagOtras * tamPagina)

  const kpis = useMemo(() => {
    const ahora = new Date()
    const vigentes = scored.filter(o => o.postulable)
    const nuevosHoy = vigentes.filter(o => dayOf(o.contrato.fecha_publica) === today).length
    let cierranHoy = 0
    let cierranManana = 0
    let cierranSemana = 0
    let nucleo = 0
    let nucleoIa = 0
    let nucleoCloud = 0
    let nucleoDev = 0
    let nucleoTel = 0
    let consultasAbiertas = 0
    for (const o of vigentes) {
      if (estadoConsultas(o.contrato.etapas_json, ahora).abierta) consultasAbiertas += 1
      if (o.nivel === 'nucleo') {
        nucleo += 1
        if (o.overlay === 'telemetria') nucleoTel += 1
        if (o.contrato.categoria_it === 'IA/analytics') nucleoIa += 1
        if (o.contrato.categoria_it === 'Cloud/hosting') nucleoCloud += 1
        if (o.contrato.categoria_it === 'Desarrollo software') nucleoDev += 1
      }
      const fin = o.contrato.fecha_fin_cotizacion
      if (!fin) continue
      if (cierraHoyInstante(fin, ahora)) cierranHoy += 1
      else {
        const d = dayOf(fin)
        if (!d) continue
        if (d === tomorrow) cierranManana += 1
        else if (d <= weekEnd && d > today) cierranSemana += 1
      }
    }
    return { nuevosHoy, cierranHoy, cierranManana, cierranSemana, nucleo, nucleoIa, nucleoCloud, nucleoDev, nucleoTel, consultasAbiertas }
  }, [scored, today, tomorrow, weekEnd])

  const filtrosActivos = (nivel ? 1 : 0) + (linea ? 1 : 0) + (cierre !== 'todos' ? 1 : 0)
  const headerAct = estadoActualizacion(actualizado)
  const headerIng = estadoIngesta(ingesta)
  const toneCls = (tone: string) =>
    tone === 'stale'
      ? 'text-xs text-red-600 dark:text-red-400'
      : tone === 'warn'
        ? 'text-xs text-amber-600 dark:text-amber-400'
        : 'text-xs text-slate-400'

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-3 py-5 sm:px-4 text-[var(--text-primary)]">
      <header>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-xl text-[var(--text-primary)] sm:text-2xl">Ruta del día</h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Oportunidades ENERTRONIC · score con análisis cuando hay TDR
            </p>
          </div>
          <div className="space-y-0.5 text-right">
            <p className={toneCls(headerIng.tone)}>{headerIng.texto}</p>
            <p className={toneCls(headerAct.tone)}>{headerAct.texto}</p>
          </div>
        </div>
      </header>

      {error && <ErrorBox retry={() => window.location.reload()}>{error}</ErrorBox>}

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Kpi label="Nuevos hoy" value={kpis.nuevosHoy} hint="postulables publicados hoy" />
          <Kpi label="Cierran hoy" value={kpis.cierranHoy} hint="hasta medianoche Lima" warn={kpis.cierranHoy > 0} />
          <Kpi label="Cierran mañana" value={kpis.cierranManana} hint="vigentes" warn={kpis.cierranManana > 0} />
          <Kpi label="Cierran esta semana" value={kpis.cierranSemana} hint="días 2–7" />
          <Kpi label="Consultas abiertas" value={kpis.consultasAbiertas} hint="ventana para enviar consultas" warn={kpis.consultasAbiertas > 0} />
          <Kpi
            label="Vigentes núcleo"
            value={kpis.nucleo}
            hint={`IA ${kpis.nucleoIa} · Cloud ${kpis.nucleoCloud} · Dev ${kpis.nucleoDev}${kpis.nucleoTel ? ` · Tel ${kpis.nucleoTel}` : ''}`}
          />
        </div>
      )}

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-medium text-slate-800 dark:text-slate-200">Postulables</h2>
          <p className="text-[11px] text-slate-500">
            Todos los postulables, ordenados por vencimiento (lo que cierra antes va primero).{' '}
            {postulablesVisibles.length.toLocaleString('es-PE')} en vista.
          </p>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setFiltrosAbiertos(v => !v)}
            aria-expanded={filtrosAbiertos}
            className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            <span className="flex items-center gap-1.5">
              Filtros
              {filtrosActivos > 0 && (
                <span className="rounded-full bg-teal-500 px-1.5 py-0.5 text-[10px] font-medium leading-none text-white">
                  {filtrosActivos}
                </span>
              )}
            </span>
            <span aria-hidden className="text-slate-400">{filtrosAbiertos ? '▴' : '▾'}</span>
          </button>

          {filtrosAbiertos && (
            <div className="space-y-2">
              <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1">
                <Chip active={nivel === null} onClick={() => { setNivel(null); resetPaginas() }}>Todos los niveles</Chip>
                {NIVELES.map(n => (
                  <Chip
                    key={n.id}
                    active={nivel === n.id}
                    tone={n.id === 'nucleo' ? 'ok' : n.id === 'marginal' ? 'muted' : 'accent'}
                    onClick={() => { setNivel(x => x === n.id ? null : n.id); resetPaginas() }}
                  >
                    {n.stars} {n.label}
                  </Chip>
                ))}
              </div>
              <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1">
                <Chip active={linea === null} onClick={() => { setLinea(null); resetPaginas() }}>Todas las líneas</Chip>
                {LINEA_CHIPS.map(c => (
                  <Chip
                    key={c.id}
                    active={linea === c.id}
                    onClick={() => { setLinea(x => x === c.id ? null : c.id); resetPaginas() }}
                  >
                    {c.label}
                  </Chip>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {([
                  ['todos', 'Cierre: todos'],
                  ['hoy', 'Cierran hoy'],
                  ['semana', 'Esta semana'],
                  ['mes', 'Este mes'],
                ] as const).map(([id, label]) => (
                  <Chip key={id} active={cierre === id} onClick={() => { setCierre(id); resetPaginas() }} tone={id === 'hoy' ? 'warn' : 'neutral'}>
                    {label}
                  </Chip>
                ))}
                <span className="ml-1 inline-flex items-center gap-1.5 border-l border-slate-200 pl-2 dark:border-slate-700">
                  <span className="text-[11px] text-slate-500">Por página</span>
                  <select
                    value={tamPagina}
                    onChange={e => { setTamPagina(Number(e.target.value)); resetPaginas() }}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                  >
                    {TAM_PAGINA_OPCIONES.map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </span>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <Skeleton className="h-40" />
        ) : postPaginados.length === 0 ? (
          <EmptyState title="Sin postulables con esos filtros" hint="Los filtros navegan; no borran el resto." />
        ) : (
          <div className="space-y-2">
            {postPaginados.map((o, i) => (
              <OportunidadCard
                key={o.contrato.id}
                o={o}
                rank={(pagPost - 1) * tamPagina + i + 1}
                compact={tamPagina > 50}
                onHide={() => void ocultar(o.contrato.id)}
              />
            ))}
            <Paginador
              pagina={pagPost}
              total={totalPagPost}
              count={postulablesVisibles.length}
              onChange={setPaginaPost}
            />
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-medium text-slate-800 dark:text-slate-200">Otras etapas</h2>
          <p className="text-[11px] text-slate-500">
            Por abrir, en evaluación o vencidos. No son postulables.{' '}
            {otras.length.toLocaleString('es-PE')} en vista.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Chip active={estadoOtras === 'cerrados'} tone="warn" onClick={() => { setEstadoOtras('cerrados'); resetPaginas() }}>
            En evaluación / cerrados
          </Chip>
          <Chip active={estadoOtras === 'por_abrir'} tone="accent" onClick={() => { setEstadoOtras('por_abrir'); resetPaginas() }}>
            Por abrir
          </Chip>
        </div>

        {loading ? (
          <Skeleton className="h-40" />
        ) : otrasPaginados.length === 0 ? (
          <EmptyState title="Nada en otras etapas" hint="No hay contratos por abrir, en evaluación ni vencidos." />
        ) : (
          <div className="space-y-2">
            {otrasPaginados.map((o, i) => (
              <OportunidadCard
                key={o.contrato.id}
                o={o}
                rank={(pagOtras - 1) * tamPagina + i + 1}
                compact={tamPagina > 50}
              />
            ))}
            <Paginador
              pagina={pagOtras}
              total={totalPagOtras}
              count={otras.length}
              onChange={setPaginaOtras}
            />
          </div>
        )}
      </section>

      {ocultosList.length > 0 && (
        <section className="space-y-3">
          <button
            type="button"
            onClick={() => setMostrarOcultos(v => !v)}
            className="text-sm font-medium text-slate-600 hover:text-teal-600 dark:text-slate-300"
          >
            {mostrarOcultos ? '▾' : '▸'} Ocultos ({ocultosList.length})
          </button>
          {mostrarOcultos && (
            <div className="space-y-2">
              {ocultosList.map((o, i) => (
                <OportunidadCard
                  key={o.contrato.id}
                  o={o}
                  rank={i + 1}
                  oculto
                  onRestore={() => void restaurar(o.contrato.id)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      <p className="pb-6 text-[11px] text-slate-400">
        Con análisis: rubro 28 + califica 18 + margen% 18 + modalidad/pago 8+8 + plazo/riesgo 5+5 + vigencia/urgencia 10+10;
        si no califica técnicamente → techo 35 (sigue en lista). Sin análisis: heurística rubro 50 + vigencia 25 + urgencia 15 + señales 10.
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
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3">
      <p className="text-[11px] text-[var(--text-secondary)]">{label}</p>
      <p className={`mt-1 text-xl font-medium ${warn ? 'text-red-500' : 'text-[var(--text-primary)]'}`}>{value.toLocaleString('es-PE')}</p>
      <p className="text-[11px] text-[var(--text-secondary)]">{hint}</p>
    </div>
  )
}

function Paginador({
  pagina,
  total,
  count,
  onChange,
}: {
  pagina: number
  total: number
  count: number
  onChange: (p: number) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      {total > 1 && (
        <button
          type="button"
          disabled={pagina <= 1}
          onClick={() => onChange(pagina - 1)}
          className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-teal-400 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
        >
          ‹ Anterior
        </button>
      )}
      <span className="text-[11px] text-slate-500">
        Página {pagina} de {total} · {count.toLocaleString('es-PE')} resultados
      </span>
      {total > 1 && (
        <button
          type="button"
          disabled={pagina >= total}
          onClick={() => onChange(pagina + 1)}
          className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-teal-400 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
        >
          Siguiente ›
        </button>
      )}
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { useTheme } from '../lib/theme'
import { fmtFechaHora, haceCuanto } from '../lib/format'
import { EmptyState, ErrorBox, Skeleton } from './ui'

// ─────────────────────────────────────────────────────────────────────────────
// Seguimiento por contrato del pipeline de IA/embedding (proceso_evento).
// Sección de Observabilidad a nivel especialista: KPIs, distribuciones,
// tabla maestra filtrable/paginada y timeline de eventos por contrato.
// ─────────────────────────────────────────────────────────────────────────────

const PAGE = 25

const ETAPA_LABEL: Record<string, string> = {
  tdr_extraido: 'TDR extraído',
  contenedor: 'Contenedor',
  chunked: 'Chunked',
  embedded: 'Embedded',
  migrado_300_60: 'Migrado 300/60',
}

const ETAPA_COLOR: Record<string, string> = {
  tdr_extraido: '#0EA5E9',
  contenedor: '#F59E0B',
  chunked: '#6366F1',
  embedded: '#8B5CF6',
  migrado_300_60: '#10B981',
}

const ETAPA_ORDEN = ['tdr_extraido', 'contenedor', 'chunked', 'embedded', 'migrado_300_60']

const CHUNK_VERSION_LABEL: Record<string, string> = {
  '500_0': '500/0 · legacy',
  '300_60': '300/60 · overlap',
}

const CHUNK_VERSION_COLOR: Record<string, string> = {
  '500_0': '#94A3B8',
  '300_60': '#10B981',
}

const TIPO_LABEL: Record<string, string> = {
  pdf: 'PDF nativo',
  ocr: 'PDF + OCR',
  contenedor_docx: 'DOCX',
  contenedor_zip: 'ZIP',
  contenedor_rar: 'RAR',
  contenedor_doc: 'DOC',
  sin_dato: 'Sin dato',
}

interface FilaContrato {
  contrato_id: number
  nro_contratacion: string | null
  descripcion: string | null
  estado: string | null
  fecha_fin_cotizacion: string | null
  fecha_publica: string | null
  tdr_tipo_extraccion: string | null
  chunk_version: string
  tdr_chars: number
  n_chunks_pdf: number
  n_chunks_api: number
  n_chunks_total: number
  n_embebidos_v2: number
  ultima_etapa: string | null
  ultimo_evento_at: string | null
  costo_embed_acum: number
  n_eventos: number
}

interface SeguimientoData {
  total: number
  filas: FilaContrato[]
}

interface ResumenData {
  contratos_con_eventos: number
  eventos_total: number
  ultimo_evento_at: string | null
  primer_evento_at: string | null
  chunks_pdf: number
  chunks_api: number
  chunks_total: number
  embebidos_v2: number
  cobertura_emb_pct: number
  costo_embed_usd: number
  tokens_embed_est: number
  por_etapa: Array<{ etapa: string; eventos: number; contratos: number; costo_usd: number; chunks_pdf_sum: number; chars_sum: number }>
  por_chunk_version: Array<{ chunk_version: string; contratos: number }>
  por_tipo_extraccion: Array<{ tipo_extraccion: string; contratos: number }>
  por_dia: Array<{ dia: string; eventos: number; costo_usd: number }>
}

interface EventoContrato {
  id: number
  created_at: string
  etapa: string
  n_chunks_pdf: number | null
  n_chunks_api: number | null
  chars_tdr: number | null
  tokens_est: number | null
  costo_usd: number | null
  tipo_extraccion: string | null
  chunk_version: string | null
  run_id: string | null
  detalle: Record<string, unknown> | null
}

function fmtNum(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString('es-PE')
}

function fmtUsd(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n <= 0) return '$0.00'
  if (n < 0.01) return '<$0.01'
  return `$${n.toFixed(3).replace(/\.?0+$/, '')}`
}

function fmtChars(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function EtapaChip({ etapa }: { etapa: string | null }) {
  if (!etapa) return <span className="text-slate-400">—</span>
  const color = ETAPA_COLOR[etapa] ?? '#64748B'
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${color}1a`, color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {ETAPA_LABEL[etapa] ?? etapa}
    </span>
  )
}

function VersionChip({ version }: { version: string }) {
  const color = CHUNK_VERSION_COLOR[version] ?? '#64748B'
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[11px] font-medium"
      style={{ backgroundColor: `${color}1a`, color }}
      title={CHUNK_VERSION_LABEL[version] ?? version}
    >
      {version}
    </span>
  )
}

/** Panel modal con el timeline completo de eventos de un contrato. */
function TimelineModal({
  contrato,
  onClose,
}: {
  contrato: FilaContrato
  onClose: () => void
}) {
  const [eventos, setEventos] = useState<EventoContrato[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [abiertos, setAbiertos] = useState<Record<number, boolean>>({})

  useEffect(() => {
    let alive = true
    setEventos(null)
    setErr(null)
    void (async () => {
      const { data, error } = await supabase.rpc('fn_proceso_eventos', {
        p_contrato_id: contrato.contrato_id,
      })
      if (!alive) return
      if (error) {
        setErr(error.message)
        return
      }
      setEventos((data ?? []) as EventoContrato[])
    })()
    return () => {
      alive = false
    }
  }, [contrato.contrato_id])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm sm:p-6">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="min-w-0">
            <h3 className="truncate text-base font-medium">
              Timeline de proceso · #{contrato.contrato_id}
            </h3>
            <p className="mt-0.5 font-mono text-xs text-slate-500">
              {contrato.nro_contratacion ?? 'sin nro'}
              {contrato.descripcion ? ` · ${contrato.descripcion.slice(0, 80)}` : ''}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {contrato.n_chunks_total} chunks · {contrato.n_embebidos_v2} embebidos ·{' '}
              {fmtUsd(contrato.costo_embed_acum)} de embedding · {contrato.n_eventos} eventos
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-2.5 py-1 text-sm dark:border-slate-700"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4">
          {err && <ErrorBox retry={() => setEventos(null)}>{err}</ErrorBox>}
          {!err && eventos === null && <Skeleton className="h-40 w-full" />}
          {eventos && eventos.length === 0 && (
            <EmptyState title="Sin eventos" hint="Este contrato aún no tiene traza en proceso_evento." />
          )}
          {eventos && eventos.length > 0 && (
            <ol className="space-y-0">
              {eventos.map((e, i) => {
                const color = ETAPA_COLOR[e.etapa] ?? '#64748B'
                const abierto = abiertos[e.id] ?? false
                const detalleEntries = e.detalle ? Object.entries(e.detalle) : []
                return (
                  <li key={e.id} className="relative flex gap-3 pb-5">
                    {i < eventos.length - 1 && (
                      <span className="absolute left-[5px] top-4 bottom-0 w-px bg-slate-200 dark:bg-slate-800" />
                    )}
                    <span
                      className="relative mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-white dark:ring-slate-900"
                      style={{ backgroundColor: color }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <EtapaChip etapa={e.etapa} />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                          {fmtFechaHora(e.created_at)}
                        </span>
                        <span className="text-xs text-slate-400">{haceCuanto(e.created_at)}</span>
                        {e.detalle?.backfill === true && (
                          <span className="rounded-full bg-slate-500/10 px-1.5 py-0.5 text-[10px] text-slate-500">
                            backfill
                          </span>
                        )}
                      </div>

                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-slate-600 dark:text-slate-400">
                        {e.n_chunks_pdf != null && <span>chunks pdf <b className="tabular-nums">{e.n_chunks_pdf}</b></span>}
                        {e.n_chunks_api != null && <span>chunks api <b className="tabular-nums">{e.n_chunks_api}</b></span>}
                        {e.chars_tdr != null && <span>chars <b className="tabular-nums">{fmtChars(e.chars_tdr)}</b></span>}
                        {e.tokens_est != null && <span>tokens <b className="tabular-nums">{fmtNum(e.tokens_est)}</b></span>}
                        {e.costo_usd != null && <span>costo <b className="tabular-nums">{fmtUsd(e.costo_usd)}</b></span>}
                        {e.chunk_version && <span>v <b>{e.chunk_version}</b></span>}
                        {e.tipo_extraccion && <span>{TIPO_LABEL[e.tipo_extraccion] ?? e.tipo_extraccion}</span>}
                      </div>

                      {e.run_id && (
                        <p className="mt-1 text-xs text-slate-400">
                          run <span className="font-mono">{e.run_id}</span>
                        </p>
                      )}

                      {detalleEntries.length > 0 && (
                        <div className="mt-1.5">
                          <button
                            onClick={() => setAbiertos((p) => ({ ...p, [e.id]: !p[e.id] }))}
                            className="text-xs font-medium text-teal-600 hover:underline dark:text-teal-400"
                          >
                            {abierto ? 'ocultar detalle' : 'ver detalle'} ({detalleEntries.length})
                          </button>
                          {abierto && (
                            <pre className="mt-1 max-h-48 overflow-auto rounded-lg bg-slate-50 p-2 text-[11px] leading-relaxed dark:bg-slate-950">
                              {JSON.stringify(e.detalle, null, 2)}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  )
}

export default function SeguimientoContrato() {
  const { theme } = useTheme()
  const axis = theme === 'dark' ? '#94a3b8' : '#64748b'
  const grid = theme === 'dark' ? '#1e293b' : '#e2e8f0'
  const tipBg = theme === 'dark' ? '#0f172a' : '#fff'
  const tipFg = theme === 'dark' ? '#e2e8f0' : '#0f172a'

  const [resumen, setResumen] = useState<ResumenData | null>(null)
  const [resumenErr, setResumenErr] = useState<string | null>(null)
  const [resumenLoading, setResumenLoading] = useState(true)

  const [tabla, setTabla] = useState<SeguimientoData | null>(null)
  const [tablaErr, setTablaErr] = useState<string | null>(null)
  const [tablaLoading, setTablaLoading] = useState(true)

  const [page, setPage] = useState(0)
  const [fEstado, setFEstado] = useState('')
  const [fVersion, setFVersion] = useState('')
  const [fEtapa, setFEtapa] = useState('')
  const [fBusqueda, setFBusqueda] = useState('')
  const [busquedaInput, setBusquedaInput] = useState('')

  const [detalle, setDetalle] = useState<FilaContrato | null>(null)

  async function loadResumen() {
    setResumenLoading(true)
    setResumenErr(null)
    const { data, error } = await supabase.rpc('fn_proceso_evento_resumen')
    if (error) {
      setResumenErr(error.message)
      setResumen(null)
      setResumenLoading(false)
      return
    }
    setResumen((data ?? null) as ResumenData | null)
    setResumenLoading(false)
  }

  async function loadTabla(p = page, estado = fEstado, version = fVersion, etapa = fEtapa, busqueda = fBusqueda) {
    setTablaLoading(true)
    setTablaErr(null)
    const { data, error } = await supabase.rpc('fn_seguimiento_contrato', {
      p_limite: PAGE,
      p_offset: p * PAGE,
      p_estado: estado || null,
      p_chunk_version: version || null,
      p_etapa: etapa || null,
      p_busqueda: busqueda || null,
    })
    if (error) {
      setTablaErr(error.message)
      setTabla(null)
      setTablaLoading(false)
      return
    }
    setTabla((data ?? null) as SeguimientoData | null)
    setTablaLoading(false)
  }

  useEffect(() => {
    void loadResumen()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void loadTabla()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, fEstado, fVersion, fEtapa, fBusqueda])

  const totalPaginas = tabla ? Math.max(1, Math.ceil(tabla.total / PAGE)) : 1

  const donutEtapa = useMemo(() => {
    if (!resumen) return []
    const total = resumen.por_etapa.reduce((a, e) => a + e.eventos, 0)
    return resumen.por_etapa
      .map((e) => ({
        name: ETAPA_LABEL[e.etapa] ?? e.etapa,
        value: e.eventos,
        color: ETAPA_COLOR[e.etapa] ?? '#64748B',
        pct: total > 0 ? (e.eventos / total) * 100 : 0,
      }))
      .filter((d) => d.value > 0)
  }, [resumen])

  const donutVersion = useMemo(() => {
    if (!resumen) return []
    const total = resumen.por_chunk_version.reduce((a, e) => a + e.contratos, 0)
    return resumen.por_chunk_version
      .map((e) => ({
        name: CHUNK_VERSION_LABEL[e.chunk_version] ?? e.chunk_version,
        value: e.contratos,
        color: CHUNK_VERSION_COLOR[e.chunk_version] ?? '#64748B',
        pct: total > 0 ? (e.contratos / total) * 100 : 0,
      }))
      .filter((d) => d.value > 0)
  }, [resumen])

  const barrasTipo = useMemo(() => {
    if (!resumen) return []
    return [...resumen.por_tipo_extraccion]
      .sort((a, b) => b.contratos - a.contratos)
      .map((t) => ({ name: TIPO_LABEL[t.tipo_extraccion] ?? t.tipo_extraccion, value: t.contratos }))
  }, [resumen])

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium">Seguimiento por contrato (pipeline de IA)</h2>
          <p className="text-xs text-slate-500">
            Traza append-only de <span className="font-mono">proceso_evento</span>: qué se le hizo a
            cada TDR, cuántos chunks generó, cuánto costó su embedding y a qué hora.
          </p>
        </div>
      </div>

      {resumenErr && <ErrorBox retry={() => void loadResumen()}>{resumenErr}</ErrorBox>}

      {resumenLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : !resumen ? (
        resumenErr ? null : (
          <EmptyState title="Sin datos" hint="No hay filas en proceso_evento todavía." />
        )
      ) : (
        <>
          {/* ── KPIs ─────────────────────────────────────────────── */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
              <p className="font-medium">Contratos trazados</p>
              <p className="mt-2 text-2xl tabular-nums">{fmtNum(resumen.contratos_con_eventos)}</p>
              <p className="mt-1 text-xs text-slate-500">{fmtNum(resumen.eventos_total)} eventos</p>
            </div>
            <div className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
              <p className="font-medium">Chunks generados</p>
              <p className="mt-2 text-2xl tabular-nums">{fmtNum(resumen.chunks_total)}</p>
              <p className="mt-1 text-xs text-slate-500 tabular-nums">
                pdf {fmtNum(resumen.chunks_pdf)} · api {fmtNum(resumen.chunks_api)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
              <p className="font-medium">Embeddings v2</p>
              <p className="mt-2 text-2xl tabular-nums">{fmtNum(resumen.embebidos_v2)}</p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-violet-500"
                  style={{ width: `${Math.min(100, resumen.cobertura_emb_pct)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-slate-500 tabular-nums">
                cobertura {resumen.cobertura_emb_pct.toFixed(2)}%
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
              <p className="font-medium">Costo de embedding</p>
              <p className="mt-2 text-2xl tabular-nums">{fmtUsd(resumen.costo_embed_usd)}</p>
              <p className="mt-1 text-xs text-slate-500 tabular-nums">
                ~{fmtNum(resumen.tokens_embed_est)} tokens · gemini-embedding-001
              </p>
            </div>
          </div>

          {resumen.ultimo_evento_at && (
            <p className="text-xs text-slate-500">
              Último evento {fmtFechaHora(resumen.ultimo_evento_at)} ({haceCuanto(resumen.ultimo_evento_at)}) ·
              primer evento {fmtFechaHora(resumen.primer_evento_at)}
            </p>
          )}

          {/* ── Eventos por día + costo ──────────────────────────── */}
          {resumen.por_dia.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <p className="mb-1 text-xs text-slate-500">Eventos y costo de embedding por día (Lima)</p>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={resumen.por_dia}>
                  <CartesianGrid stroke={grid} vertical={false} />
                  <XAxis dataKey="dia" tick={{ fill: axis, fontSize: 10 }} />
                  <YAxis yAxisId="left" tick={{ fill: axis, fontSize: 10 }} width={40} allowDecimals={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: axis, fontSize: 10 }} width={40} />
                  <Tooltip
                    contentStyle={{ background: tipBg, border: '1px solid #334155', color: tipFg }}
                    formatter={(v, name) => (name === 'Costo USD' ? fmtUsd(Number(v)) : fmtNum(Number(v)))}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="left" dataKey="eventos" fill="#6366F1" radius={[3, 3, 0, 0]} name="Eventos" />
                  <Line yAxisId="right" type="monotone" dataKey="costo_usd" stroke="#14B8A6" strokeWidth={2} dot={{ r: 2 }} name="Costo USD" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Distribuciones ───────────────────────────────────── */}
          <div className="grid gap-3 lg:grid-cols-3">
            {/* Donut por etapa */}
            <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <p className="mb-1 text-xs text-slate-500">Eventos por etapa</p>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={donutEtapa} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2} stroke="none">
                    {donutEtapa.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: tipBg, border: '1px solid #334155', color: tipFg }}
                    formatter={(v) => fmtNum(Number(v))}
                  />
                </PieChart>
              </ResponsiveContainer>
              <ul className="mt-2 space-y-1">
                {donutEtapa.map((d) => (
                  <li key={d.name} className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: d.color }} />
                      {d.name}
                    </span>
                    <span className="tabular-nums text-slate-500">{fmtNum(d.value)} · {d.pct.toFixed(1)}%</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Donut por chunk_version */}
            <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <p className="mb-1 text-xs text-slate-500">Contratos por chunk_version</p>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={donutVersion} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2} stroke="none">
                    {donutVersion.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: tipBg, border: '1px solid #334155', color: tipFg }}
                    formatter={(v) => fmtNum(Number(v))}
                  />
                </PieChart>
              </ResponsiveContainer>
              <ul className="mt-2 space-y-1">
                {donutVersion.map((d) => (
                  <li key={d.name} className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: d.color }} />
                      {d.name}
                    </span>
                    <span className="tabular-nums text-slate-500">{fmtNum(d.value)} · {d.pct.toFixed(1)}%</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Bar por tipo de extracción */}
            <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <p className="mb-1 text-xs text-slate-500">Contratos por tipo de extracción</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barrasTipo} layout="vertical" margin={{ left: 8, right: 12 }}>
                  <CartesianGrid stroke={grid} horizontal={false} />
                  <XAxis type="number" tick={{ fill: axis, fontSize: 10 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={82} tick={{ fill: axis, fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ background: tipBg, border: '1px solid #334155', color: tipFg }}
                    formatter={(v) => fmtNum(Number(v))}
                  />
                  <Bar dataKey="value" fill="#F59E0B" radius={[0, 3, 3, 0]} name="Contratos" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {/* ── Filtros + tabla maestra ──────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
        <label className="text-xs">
          <span className="mb-1 block text-slate-500">Buscar (nro / descripción)</span>
          <input
            type="text"
            value={busquedaInput}
            placeholder="CM-984, entidad…"
            onChange={(e) => setBusquedaInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setPage(0)
                setFBusqueda(busquedaInput.trim())
              }
            }}
            className="w-48 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
        <label className="text-xs">
          <span className="mb-1 block text-slate-500">Estado</span>
          <select
            value={fEstado}
            onChange={(e) => {
              setFEstado(e.target.value)
              setPage(0)
            }}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="">Todos</option>
            {['Vigente', 'En Evaluación', 'Culminado'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          <span className="mb-1 block text-slate-500">Chunk version</span>
          <select
            value={fVersion}
            onChange={(e) => {
              setFVersion(e.target.value)
              setPage(0)
            }}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="">Todas</option>
            <option value="500_0">500/0 (legacy)</option>
            <option value="300_60">300/60 (overlap)</option>
          </select>
        </label>
        <label className="text-xs">
          <span className="mb-1 block text-slate-500">Última etapa</span>
          <select
            value={fEtapa}
            onChange={(e) => {
              setFEtapa(e.target.value)
              setPage(0)
            }}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="">Todas</option>
            {ETAPA_ORDEN.map((e) => (
              <option key={e} value={e}>{ETAPA_LABEL[e]}</option>
            ))}
          </select>
        </label>
      </div>

      {tablaErr && <ErrorBox retry={() => void loadTabla()}>{tablaErr}</ErrorBox>}

      {tablaLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : !tabla ? (
        tablaErr ? null : (
          <EmptyState title="Sin datos" hint="No se pudo leer fn_seguimiento_contrato." />
        )
      ) : tabla.total === 0 ? (
        <EmptyState title="Sin resultados" hint="Ningún contrato coincide con los filtros." />
      ) : (
        <>
          <p className="text-xs text-slate-500">
            {fmtNum(tabla.total)} contratos · página {page + 1} de {totalPaginas}
          </p>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full min-w-[64rem] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
                <tr>
                  <th className="px-3 py-2 font-medium">Contrato</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 font-medium">Versión</th>
                  <th className="px-3 py-2 text-right font-medium">Chunks pdf</th>
                  <th className="px-3 py-2 text-right font-medium">Chunks api</th>
                  <th className="px-3 py-2 text-right font-medium">Emb. v2</th>
                  <th className="px-3 py-2 text-right font-medium">Costo embed</th>
                  <th className="px-3 py-2 font-medium">Última etapa</th>
                  <th className="px-3 py-2 font-medium">Último evento</th>
                  <th className="px-3 py-2 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {tabla.filas.map((c) => {
                  const pct = c.n_chunks_total > 0 ? (c.n_embebidos_v2 / c.n_chunks_total) * 100 : 0
                  return (
                    <tr key={c.contrato_id} className="border-t border-slate-200 dark:border-slate-800">
                      <td className="px-3 py-2">
                        <Link
                          to={`/analisis/${c.contrato_id}`}
                          className="font-medium text-teal-600 hover:underline dark:text-teal-400"
                        >
                          {c.descripcion || `Contrato ${c.contrato_id}`}
                        </Link>
                        <span className="mt-0.5 block font-mono text-xs text-slate-500">
                          {c.nro_contratacion ?? `#${c.contrato_id}`}
                        </span>
                        {c.tdr_tipo_extraccion && (
                          <span className="mt-0.5 block text-[11px] text-slate-400">
                            {TIPO_LABEL[c.tdr_tipo_extraccion] ?? c.tdr_tipo_extraccion}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">{c.estado ?? '—'}</td>
                      <td className="px-3 py-2"><VersionChip version={c.chunk_version} /></td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtNum(c.n_chunks_pdf)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtNum(c.n_chunks_api)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        <span className="font-medium">{fmtNum(c.n_embebidos_v2)}</span>
                        <span className="ml-1 text-xs text-slate-400">({pct.toFixed(0)}%)</span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtUsd(c.costo_embed_acum)}</td>
                      <td className="px-3 py-2"><EtapaChip etapa={c.ultima_etapa} /></td>
                      <td className="px-3 py-2 text-xs">
                        <span className="block">{fmtFechaHora(c.ultimo_evento_at)}</span>
                        <span className="block text-slate-400">{haceCuanto(c.ultimo_evento_at)}</span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => setDetalle(c)}
                          className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium hover:border-teal-400 dark:border-slate-700"
                        >
                          timeline
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-2 text-xs">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40 dark:border-slate-700"
            >
              ← Anterior
            </button>
            <span className="text-slate-500">
              página {page + 1} de {totalPaginas}
            </span>
            <button
              disabled={page >= totalPaginas - 1}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40 dark:border-slate-700"
            >
              Siguiente →
            </button>
          </div>
        </>
      )}

      {detalle && <TimelineModal contrato={detalle} onClose={() => setDetalle(null)} />}
    </section>
  )
}

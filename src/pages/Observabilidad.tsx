import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { AI_PROXY, supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useTheme } from '../lib/theme'
import { labelCat, tipoEntidad } from '../lib/cats'
import { EmptyState, ErrorBox, Skeleton } from '../components/ui'
import SeguimientoContrato from '../components/SeguimientoContrato'

const TIPOS = ['texto', 'tabla', 'grafica', 'tabla_grafica'] as const
type TipoRespuesta = (typeof TIPOS)[number]

const TIPO_LABEL: Record<TipoRespuesta, string> = {
  texto: 'Texto',
  tabla: 'Tabla',
  grafica: 'Gráfica',
  tabla_grafica: 'Tabla + gráfica',
}

interface LastError {
  status: number | null
  body: string
  timestamp: string | null
  source?: string | null
}

interface TokenExpira {
  expira: string
  leido_utc: string
  source?: string | null
}

/** Fila de fn_sin_intento() (con rubro y semántica). */
interface SinIntentoRow {
  id: number
  nro: string | null
  titulo: string
  entidad: string | null
  objeto: string | null
  categoria_it: string | null
  relevancia_ia: string | null
  rubro: string | null
  nom_area_usuaria: string | null
  fecha_fin_cotizacion: string | null
  dias: number | null
  urgente: boolean
}

interface SinIntentoData {
  total: number
  total_ti: number
  resumen: Array<{ rubro: string; n: number }>
  page_size: number
  offset: number
  rows: SinIntentoRow[]
}

interface AdminStats {
  day: string
  kv: {
    flash: number
    analyze: number
    cotizar: number
    cotizar_tipo: Record<TipoRespuesta, number>
    chat_cache: { hit: number; miss: number }
    pipeline_trigger_last_error: LastError | null
    pipeline_trigger_last_ok: LastError | null
    pipeline_trigger_token_expira: TokenExpira | null
  }
}

const TRIGGER_STALE_MS = 36 * 60 * 60 * 1000

/** Respuesta de fn_uso_ia_stats(): traza unificada de consumo por componente. */
interface UsoIaStats {
  desde: string
  hasta: string
  total: {
    llamadas: number
    tokens_prompt: number
    tokens_completion: number
    tokens_cached: number
    tokens_thoughts: number
    tokens_total: number
    costo_usd: number
    latencia_promedio_ms: number
  }
  por_dia: Array<{ dia: string; llamadas: number; tokens_total: number; costo_usd: number }>
  por_componente: Array<{
    componente: string
    llamadas: number
    tokens_prompt: number
    tokens_completion: number
    tokens_thoughts: number
    tokens_total: number
    costo_usd: number
  }>
  por_modelo: Array<{
    modelo: string
    llamadas: number
    tokens_prompt: number
    tokens_completion: number
    tokens_thoughts: number
    tokens_total: number
    costo_usd: number
    latencia_promedio_ms: number
  }>
  por_usuario: Array<{
    user_id: string
    email: string
    llamadas: number
    tokens_total: number
    costo_usd: number
  }>
  por_contrato: Array<{
    contrato_id: number
    titulo: string
    nro: string | null
    llamadas: number
    tokens_total: number
    costo_usd: number
  }>
  recientes: Array<{
    created_at: string
    hora: string
    componente: string
    modelo: string | null
    user_email: string
    contrato_id: number | null
    titulo: string
    tokens_total: number
    costo_usd: number | null
    cache_hit: boolean | null
    tipo_respuesta: string | null
  }>
}

const COMPONENTE_LABEL: Record<string, string> = {
  chat: 'Chat RAG',
  cotizar: 'Cotizar',
  analizar: 'Analizar',
  ocr: 'OCR',
  embedding: 'Embeddings',
  clasificar: 'Clasificación',
  query_rewrite: 'Reescritura de query',
}

const COMPONENTE_COLOR: Record<string, string> = {
  chat: '#14B8A6',
  cotizar: '#6366F1',
  analizar: '#0EA5E9',
  ocr: '#F59E0B',
  embedding: '#8B5CF6',
  clasificar: '#EC4899',
  query_rewrite: '#A3E635',
}

const RUBRO_META: Record<string, { label: string; color: string; desc: string }> = {
  nucleo: { label: 'Núcleo', color: '#14B8A6', desc: 'Foco principal (IA, cloud, software, telemetría)' },
  adyacente: { label: 'Adyacente', color: '#0EA5E9', desc: 'Cercano (BD/ERP, Oracle)' },
  oportunista: { label: 'Oportunista', color: '#F59E0B', desc: 'Ocasional (soporte, redes, licencias, seguridad…)' },
  marginal: { label: 'Marginal', color: '#94A3B8', desc: 'Hardware u otros' },
  sin_clasificar: { label: 'Sin rubro TI', color: '#64748B', desc: 'Sin categoría IT ni relevancia IA' },
}

function fmtUsd(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n <= 0) return '$0.00'
  if (n < 0.01) return '<$0.01'
  return `$${n.toFixed(3).replace(/\.?0+$/, '')}`
}

function fmtNum(n: number): string {
  return n.toLocaleString('es-PE')
}

function fmtTs(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('es-PE')
}

function fmtDate(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(d.getTime())) return isoDate
  return d.toLocaleDateString('es-PE', { year: 'numeric', month: 'short', day: 'numeric' })
}

function diasDesde(isoDate: string): number {
  const d = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(d.getTime())) return 0
  const hoy = new Date()
  const utcHoy = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  const utcVer = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.floor((utcHoy - utcVer) / 86_400_000)
}

function diasHasta(isoDate: string): number {
  const d = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(d.getTime())) return 0
  const hoy = new Date()
  const utcHoy = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  const utcVer = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.round((utcVer - utcHoy) / 86_400_000)
}

function localIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function isoDiasAtras(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return localIso(d)
}

const SIN_PAGE = 25

function CubsoCard({
  version,
  items,
  cargado,
}: {
  version: string
  items: number | null
  cargado: string | null
}) {
  const dias = diasDesde(version)
  const alerta = dias > 365
  return (
    <div
      className={
        alerta
          ? 'rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300'
          : 'rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800'
      }
    >
      <p className="font-medium">
        {alerta ? 'Catálogo CUBSO desactualizado' : 'Versión cargada'}
      </p>
      <p className="mt-1">
        Versión {fmtDate(version)}
        {items != null ? ` · ${items.toLocaleString('es-PE')} ítems` : ''}
        {` · ${dias.toLocaleString('es-PE')} días`}
      </p>
      {cargado && (
        <p className="mt-1 text-xs text-slate-500">Cargado {fmtTs(cargado)}</p>
      )}
      {alerta && (
        <p className="mt-2">
          Catalogo CUBSO desactualizado. Descargar la version vigente en
          gob.pe/oece -&gt; Publicaciones del SEACE -&gt; Documentos de orientacion
          (SEACE) -&gt; filtro CUBSO, y recargar con scripts/cargar_cubso.py
        </p>
      )}
    </div>
  )
}

function RubroChip({ rubro }: { rubro: string | null }) {
  const meta = RUBRO_META[rubro ?? ''] ?? RUBRO_META.sin_clasificar
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${meta.color}1a`, color: meta.color }}
      title={meta.desc}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
      {meta.label}
    </span>
  )
}

function ComponenteChip({ componente }: { componente: string }) {
  const color = COMPONENTE_COLOR[componente] ?? '#64748B'
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${color}1a`, color }}
    >
      {COMPONENTE_LABEL[componente] ?? componente}
    </span>
  )
}

export default function Observabilidad() {
  const { session } = useAuth()
  const { theme } = useTheme()
  const axis = theme === 'dark' ? '#94a3b8' : '#64748b'
  const grid = theme === 'dark' ? '#1e293b' : '#e2e8f0'
  const tipBg = theme === 'dark' ? '#0f172a' : '#fff'
  const tipFg = theme === 'dark' ? '#e2e8f0' : '#0f172a'

  const [stats, setStats] = useState<AdminStats | null>(null)
  const [statsErr, setStatsErr] = useState<string | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  const [cubso, setCubso] = useState<{
    version_catalogo: string
    items: number | null
    cargado_utc: string | null
  } | null>(null)
  const [cubsoErr, setCubsoErr] = useState<string | null>(null)
  const [cubsoLoading, setCubsoLoading] = useState(true)

  // Consumo de IA
  const [uso, setUso] = useState<UsoIaStats | null>(null)
  const [usoErr, setUsoErr] = useState<string | null>(null)
  const [usoLoading, setUsoLoading] = useState(true)
  const [usoDesde, setUsoDesde] = useState(() => isoDiasAtras(30))
  const [usoHasta, setUsoHasta] = useState(() => localIso(new Date()))
  const [modeloFiltro, setModeloFiltro] = useState('')
  const [compFiltro, setCompFiltro] = useState('')
  const [modelos, setModelos] = useState<string[]>([])

  // Postulables sin intento
  const [sinIntento, setSinIntento] = useState<SinIntentoData | null>(null)
  const [sinIntentoErr, setSinIntentoErr] = useState<string | null>(null)
  const [sinIntentoLoading, setSinIntentoLoading] = useState(true)
  const [sinPage, setSinPage] = useState(0)
  const [sinSoloTi, setSinSoloTi] = useState(false)

  async function loadStats() {
    setStatsLoading(true)
    setStatsErr(null)
    const token = session?.access_token
    if (!token) {
      setStatsErr('No hay sesión.')
      setStatsLoading(false)
      return
    }
    try {
      const res = await fetch(`${AI_PROXY}/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = await res.json().catch(() => ({})) as { error?: string; day?: string; kv?: AdminStats['kv'] }
      if (!res.ok) {
        const msg = res.status === 401
          ? 'Sesión inválida o expirada.'
          : res.status === 403
            ? 'No tenés permiso de admin.'
            : res.status === 503
              ? 'El proxy no pudo leer los contadores.'
              : (body.error || `HTTP ${res.status}`)
        setStatsErr(msg)
        setStats(null)
        return
      }
      if (!body.day || !body.kv) {
        setStatsErr('Respuesta incompleta del proxy.')
        setStats(null)
        return
      }
      setStats(body as AdminStats)
    } catch (e) {
      setStatsErr(e instanceof Error ? e.message : 'No se pudo leer /admin/stats')
      setStats(null)
    } finally {
      setStatsLoading(false)
    }
  }

  async function loadCubso() {
    setCubsoLoading(true)
    setCubsoErr(null)
    const { data, error } = await supabase
      .from('cubso_version')
      .select('version_catalogo, items, cargado_utc')
      .eq('id', 1)
      .maybeSingle()
    if (error) {
      setCubsoErr(error.message)
      setCubso(null)
      setCubsoLoading(false)
      return
    }
    if (!data?.version_catalogo) {
      setCubso(null)
      setCubsoLoading(false)
      return
    }
    setCubso({
      version_catalogo: data.version_catalogo,
      items: typeof data.items === 'number' ? data.items : null,
      cargado_utc: data.cargado_utc ?? null,
    })
    setCubsoLoading(false)
  }

  async function loadModelos() {
    const { data, error } = await supabase.rpc('fn_uso_ia_modelos')
    if (!error && Array.isArray(data)) {
      setModelos(data.map((m) => String(m)).filter(Boolean))
    }
  }

  async function loadUso() {
    setUsoLoading(true)
    setUsoErr(null)
    const { data, error } = await supabase.rpc('fn_uso_ia_stats', {
      p_desde: usoDesde || null,
      p_hasta: usoHasta || null,
      p_modelo: modeloFiltro || null,
      p_componente: compFiltro || null,
    })
    if (error) {
      setUsoErr(error.message)
      setUso(null)
      setUsoLoading(false)
      return
    }
    setUso((data ?? null) as UsoIaStats | null)
    setUsoLoading(false)
  }

  async function loadSinIntento(page = sinPage, soloTi = sinSoloTi) {
    setSinIntentoLoading(true)
    setSinIntentoErr(null)
    const { data, error } = await supabase.rpc('fn_sin_intento', {
      p_limite: SIN_PAGE,
      p_offset: page * SIN_PAGE,
      p_solo_ti: soloTi,
    })
    if (error) {
      setSinIntentoErr(error.message)
      setSinIntento(null)
      setSinIntentoLoading(false)
      return
    }
    setSinIntento((data ?? null) as SinIntentoData | null)
    setSinIntentoLoading(false)
  }

  useEffect(() => {
    void loadStats()
    void loadCubso()
    void loadModelos()
    // session.access_token basta; no re-fetch en cada render del objeto session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token])

  useEffect(() => {
    void loadUso()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token, usoDesde, usoHasta, modeloFiltro, compFiltro])

  useEffect(() => {
    void loadSinIntento()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token, sinPage, sinSoloTi])

  const lastErr = stats?.kv.pipeline_trigger_last_error ?? null
  const lastOk = stats?.kv.pipeline_trigger_last_ok ?? null
  const tokenExpira = stats?.kv.pipeline_trigger_token_expira ?? null
  const diasToken = tokenExpira ? diasHasta(tokenExpira.expira) : null
  const lastOkMs = lastOk?.timestamp ? Date.parse(lastOk.timestamp) : NaN
  const lastOkAgeMs = Number.isFinite(lastOkMs) ? Date.now() - lastOkMs : null
  const triggerStale = lastOkAgeMs != null && lastOkAgeMs > TRIGGER_STALE_MS
  const triggerSinOk = Boolean(stats) && !lastOk

  let tokenCls = 'rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800'
  if (diasToken !== null && diasToken < 7) {
    tokenCls = 'rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300'
  } else if (diasToken !== null && diasToken < 14) {
    tokenCls = 'rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300'
  }

  const kvRows = useMemo(() => {
    if (!stats) return []
    const { kv } = stats
    return [
      { clave: `flash:${stats.day}`, label: 'Flash (chat RAG)', valor: kv.flash },
      { clave: `analyze:${stats.day}`, label: 'Analizar (MISS)', valor: kv.analyze },
      { clave: `cotizar:${stats.day}`, label: 'Cotizar (MISS)', valor: kv.cotizar },
      { clave: `cotizar_tipo:texto:${stats.day}`, label: 'Cotizar tipo · texto', valor: kv.cotizar_tipo.texto },
      { clave: `cotizar_tipo:tabla:${stats.day}`, label: 'Cotizar tipo · tabla', valor: kv.cotizar_tipo.tabla },
      { clave: `cotizar_tipo:grafica:${stats.day}`, label: 'Cotizar tipo · gráfica', valor: kv.cotizar_tipo.grafica },
      { clave: `cotizar_tipo:tabla_grafica:${stats.day}`, label: 'Cotizar tipo · tabla+gráfica', valor: kv.cotizar_tipo.tabla_grafica },
      { clave: `chat_cache:hit:${stats.day}`, label: 'Caché chat · hit', valor: kv.chat_cache.hit },
      { clave: `chat_cache:miss:${stats.day}`, label: 'Caché chat · miss', valor: kv.chat_cache.miss },
    ]
  }, [stats])

  const compBars = useMemo(() => {
    if (!uso) return []
    return uso.por_componente.map((c) => ({
      label: COMPONENTE_LABEL[c.componente] ?? c.componente,
      Prompt: c.tokens_prompt,
      Completion: c.tokens_completion,
    }))
  }, [uso])

  const donut = useMemo(() => {
    if (!uso) return []
    const totalCosto = uso.por_componente.reduce((a, c) => a + (c.costo_usd ?? 0), 0)
    return uso.por_componente
      .map((c) => ({
        name: COMPONENTE_LABEL[c.componente] ?? c.componente,
        value: Number(c.costo_usd ?? 0),
        color: COMPONENTE_COLOR[c.componente] ?? '#64748B',
        pct: totalCosto > 0 ? ((c.costo_usd ?? 0) / totalCosto) * 100 : 0,
      }))
      .filter((d) => d.value > 0)
  }, [uso])

  const totalPaginas = sinIntento ? Math.max(1, Math.ceil(sinIntento.total / SIN_PAGE)) : 1

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-3 py-5 sm:px-4">
      <div>
        <h1 className="text-lg font-medium">Observabilidad</h1>
        <p className="text-sm text-slate-500">
          Solo lectura · consumo de IA, cupos y caché en UTC · sin llamadas a Gemini.
        </p>
        <p className="mt-2 text-sm">
          <Link to="/dashboard" className="font-medium text-teal-600 hover:underline dark:text-teal-400">
            KPIs de conversión y negocio → Dashboard
          </Link>
        </p>
      </div>

      {/* ── Pipeline trigger ─────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium">Pipeline trigger</h2>
        {statsErr && <ErrorBox retry={() => void loadStats()}>{statsErr}</ErrorBox>}
        {statsLoading ? (
          <Skeleton className="h-28 w-full" />
        ) : stats ? (
          <div className="space-y-3">
            {triggerStale && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                <p className="font-medium">
                  El trigger no dispara desde {fmtTs(lastOk?.timestamp ?? null)}
                </p>
                <p className="mt-1">
                  Más de 36 h sin un dispatch OK. Si el PAT venció (401), renovar
                  en GitHub y <span className="font-mono text-xs">wrangler secret put GITHUB_PAT</span>.
                </p>
              </div>
            )}
            {triggerSinOk && !triggerStale && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
                <p className="font-medium">Sin last-ok todavía</p>
                <p className="mt-1">
                  El Worker escribe esta marca en el próximo cron (09:00 Lima) o
                  en un POST de prueba. No es una falla por sí sola.
                </p>
              </div>
            )}
            {!triggerStale && lastOk && (
              <div className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
                <p className="font-medium">Último dispatch OK</p>
                <p className="mt-1">
                  {fmtTs(lastOk.timestamp)}
                  {lastOk.source ? ` · ${lastOk.source}` : ''}
                  {lastOk.status != null ? ` · HTTP ${lastOk.status}` : ''}
                </p>
              </div>
            )}
            {lastErr && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                <p className="font-medium">Último error del pipeline-trigger</p>
                <p className="mt-1">
                  HTTP {lastErr.status ?? '—'} · {fmtTs(lastErr.timestamp)}
                  {lastErr.source ? ` · ${lastErr.source}` : ''}
                </p>
                {lastErr.status === 401 && (
                  <p className="mt-1">
                    401 = PAT expirado o revocado. Regenerar token_seace_monitor
                    y cargar GITHUB_PAT en Cloudflare.
                  </p>
                )}
                {lastErr.body && (
                  <p className="mt-2 whitespace-pre-wrap break-all font-mono text-xs">{lastErr.body}</p>
                )}
              </div>
            )}
            {tokenExpira ? (
              <div className={tokenCls}>
                <p className="font-medium">Token GitHub (GITHUB_PAT)</p>
                <p className="mt-1">
                  Vence el {fmtDate(tokenExpira.expira)} ·{' '}
                  {diasToken !== null && diasToken < 0
                    ? 'vencido'
                    : `en ${diasToken} días`}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  github-authentication-token-expiration · leído {fmtTs(tokenExpira.leido_utc)}
                  {tokenExpira.source ? ` · ${tokenExpira.source}` : ''}
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
                <p className="font-medium">Token GitHub (GITHUB_PAT)</p>
                <p className="mt-1">
                  Sin dato de expiración todavía: lo escribe el trigger en el
                  próximo dispatch (cron 09:00 Lima o POST de prueba).
                </p>
              </div>
            )}
          </div>
        ) : null}
      </section>

      {/* ── Consumo de IA ────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Consumo de IA (traza unificada)</h2>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => {
                  setUsoDesde(isoDiasAtras(d))
                  setUsoHasta(localIso(new Date()))
                }}
                className="rounded-lg border border-slate-300 px-2.5 py-1 dark:border-slate-700"
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
          <label className="text-xs">
            <span className="mb-1 block text-slate-500">Desde</span>
            <input
              type="date"
              value={usoDesde}
              onChange={(e) => setUsoDesde(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
          <label className="text-xs">
            <span className="mb-1 block text-slate-500">Hasta</span>
            <input
              type="date"
              value={usoHasta}
              onChange={(e) => setUsoHasta(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
          <label className="text-xs">
            <span className="mb-1 block text-slate-500">Modelo</span>
            <select
              value={modeloFiltro}
              onChange={(e) => setModeloFiltro(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="">Todos</option>
              {modelos.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            <span className="mb-1 block text-slate-500">Componente</span>
            <select
              value={compFiltro}
              onChange={(e) => setCompFiltro(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="">Todos</option>
              {Object.keys(COMPONENTE_LABEL).map((k) => (
                <option key={k} value={k}>{COMPONENTE_LABEL[k]}</option>
              ))}
            </select>
          </label>
        </div>

        <p className="text-sm text-slate-500">
          Tokens reales (usageMetadata) y costo estimado de todos los componentes:
          chat, cotizar, analizar, OCR, embeddings y clasificación. El costo se calcula
          con la tarifa por modelo (input + output + razonamiento).
        </p>

        {usoErr && <ErrorBox retry={() => void loadUso()}>{usoErr}</ErrorBox>}
        {usoLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : !uso ? (
          usoErr ? null : (
            <EmptyState title="Sin datos" hint="No hay filas en uso_ia todavía." />
          )
        ) : (
          <div className="space-y-3">
            {/* Totales */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
                <p className="font-medium">Llamadas</p>
                <p className="mt-2 text-2xl tabular-nums">{fmtNum(uso.total.llamadas)}</p>
                <p className="mt-1 text-xs text-slate-500">{uso.desde} → {uso.hasta}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
                <p className="font-medium">Tokens totales</p>
                <p className="mt-2 text-2xl tabular-nums">{fmtNum(uso.total.tokens_total)}</p>
                <p className="mt-1 text-xs text-slate-500 tabular-nums">
                  prompt {fmtNum(uso.total.tokens_prompt)} · comp {fmtNum(uso.total.tokens_completion)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
                <p className="font-medium">Costo estimado</p>
                <p className="mt-2 text-2xl tabular-nums">{fmtUsd(uso.total.costo_usd)}</p>
                <p className="mt-1 text-xs text-slate-500">USD · Gemini prepago</p>
              </div>
              <div className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
                <p className="font-medium">Costo por llamada</p>
                <p className="mt-2 text-2xl tabular-nums">
                  {fmtUsd(uso.total.llamadas > 0 ? uso.total.costo_usd / uso.total.llamadas : 0)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  thoughts {fmtNum(uso.total.tokens_thoughts)} · cached {fmtNum(uso.total.tokens_cached)}
                </p>
              </div>
            </div>

            {/* Trend costo + llamadas */}
            {uso.por_dia.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                <p className="mb-1 text-xs text-slate-500">Costo (USD) y llamadas por día</p>
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart data={uso.por_dia}>
                    <CartesianGrid stroke={grid} vertical={false} />
                    <XAxis dataKey="dia" tick={{ fill: axis, fontSize: 10 }} />
                    <YAxis yAxisId="left" tick={{ fill: axis, fontSize: 10 }} width={44} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: axis, fontSize: 10 }} width={30} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: tipBg, border: '1px solid #334155', color: tipFg }}
                      formatter={(v) => fmtUsd(Number(v))}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar yAxisId="left" dataKey="costo_usd" fill="#14B8A6" radius={[3, 3, 0, 0]} name="Costo USD" />
                    <Line yAxisId="right" type="monotone" dataKey="llamadas" stroke="#6366F1" strokeWidth={2} dot={{ r: 2 }} name="Llamadas" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Stacked tokens por componente */}
            {compBars.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                <p className="mb-1 text-xs text-slate-500">Tokens por componente (prompt vs completion)</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={compBars}>
                    <CartesianGrid stroke={grid} vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: axis, fontSize: 11 }} interval={0} />
                    <YAxis tick={{ fill: axis, fontSize: 10 }} width={48} />
                    <Tooltip
                      contentStyle={{ background: tipBg, border: '1px solid #334155', color: tipFg }}
                      formatter={(v) => fmtNum(Number(v))}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Prompt" stackId="a" fill="#14B8A6" />
                    <Bar dataKey="Completion" stackId="a" fill="#6366F1" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Donut costo por componente */}
            {donut.length > 0 && (
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                  <p className="mb-1 text-xs text-slate-500">Costo por componente</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={donut}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {donut.map((d, i) => (
                          <Cell key={i} fill={d.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: tipBg, border: '1px solid #334155', color: tipFg }}
                        formatter={(v) => fmtUsd(Number(v))}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
                  <p className="mb-2 text-xs text-slate-500">Participación del costo</p>
                  <ul className="space-y-2">
                    {donut.map((d) => (
                      <li key={d.name} className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: d.color }} />
                          {d.name}
                        </span>
                        <span className="tabular-nums">
                          {fmtUsd(d.value)} · {d.pct.toFixed(1)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Por modelo */}
            {uso.por_modelo.length > 0 && (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full min-w-[46rem] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
                    <tr>
                      <th className="px-3 py-2 font-medium">Modelo</th>
                      <th className="px-3 py-2 text-right font-medium">Llamadas</th>
                      <th className="px-3 py-2 text-right font-medium">Prompt</th>
                      <th className="px-3 py-2 text-right font-medium">Completion</th>
                      <th className="px-3 py-2 text-right font-medium">Thoughts</th>
                      <th className="px-3 py-2 text-right font-medium">Total</th>
                      <th className="px-3 py-2 text-right font-medium">Costo</th>
                      <th className="px-3 py-2 text-right font-medium">$/llamada</th>
                      <th className="px-3 py-2 text-right font-medium">Lat. prom.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uso.por_modelo.map((m) => (
                      <tr key={m.modelo} className="border-t border-slate-200 dark:border-slate-800">
                        <td className="px-3 py-2 font-mono text-xs">{m.modelo}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(m.llamadas)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(m.tokens_prompt)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(m.tokens_completion)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(m.tokens_thoughts)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(m.tokens_total)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtUsd(m.costo_usd)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {fmtUsd(m.llamadas > 0 ? m.costo_usd / m.llamadas : 0)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {m.latencia_promedio_ms > 0 ? `${fmtNum(m.latencia_promedio_ms)} ms` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Por usuario */}
            {uso.por_usuario.length > 0 && (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full min-w-[32rem] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
                    <tr>
                      <th className="px-3 py-2 font-medium">Usuario</th>
                      <th className="px-3 py-2 text-right font-medium">Llamadas</th>
                      <th className="px-3 py-2 text-right font-medium">Tokens</th>
                      <th className="px-3 py-2 text-right font-medium">Costo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uso.por_usuario.map((u) => (
                      <tr key={u.user_id} className="border-t border-slate-200 dark:border-slate-800">
                        <td className="px-3 py-2">
                          <span className="block">{u.email}</span>
                          <span className="block font-mono text-xs text-slate-500">{u.user_id}</span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(u.llamadas)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(u.tokens_total)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtUsd(u.costo_usd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Por contrato */}
            {uso.por_contrato.length > 0 && (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full min-w-[36rem] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
                    <tr>
                      <th className="px-3 py-2 font-medium">Proyecto</th>
                      <th className="px-3 py-2 text-right font-medium">Llamadas</th>
                      <th className="px-3 py-2 text-right font-medium">Tokens</th>
                      <th className="px-3 py-2 text-right font-medium">Costo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uso.por_contrato.map((c) => (
                      <tr key={c.contrato_id} className="border-t border-slate-200 dark:border-slate-800">
                        <td className="px-3 py-2">
                          <Link
                            to={`/analisis/${c.contrato_id}`}
                            className="font-medium text-teal-600 hover:underline dark:text-teal-400"
                          >
                            {c.titulo || `Contrato ${c.contrato_id}`}
                          </Link>
                          {c.nro && <span className="mt-0.5 block font-mono text-xs text-slate-500">{c.nro}</span>}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(c.llamadas)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(c.tokens_total)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtUsd(c.costo_usd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Feed de actividad reciente */}
            {uso.recientes.length > 0 && (
              <div className="space-y-1">
                <h3 className="text-xs font-medium text-slate-500">
                  Actividad reciente (quién gastó, en qué proyecto y a qué hora)
                </h3>
                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full min-w-[52rem] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
                      <tr>
                        <th className="px-3 py-2 font-medium">Hora (UTC)</th>
                        <th className="px-3 py-2 font-medium">Componente</th>
                        <th className="px-3 py-2 font-medium">Modelo</th>
                        <th className="px-3 py-2 font-medium">Usuario</th>
                        <th className="px-3 py-2 font-medium">Proyecto</th>
                        <th className="px-3 py-2 text-right font-medium">Tokens</th>
                        <th className="px-3 py-2 text-right font-medium">Costo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uso.recientes.map((r, i) => (
                        <tr key={i} className="border-t border-slate-200 dark:border-slate-800">
                          <td className="px-3 py-2 tabular-nums text-xs">{r.hora}</td>
                          <td className="px-3 py-2">
                            <ComponenteChip componente={r.componente} />
                            {r.cache_hit === true && (
                              <span className="ml-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-xs text-emerald-600 dark:text-emerald-400">hit</span>
                            )}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">{r.modelo ?? '—'}</td>
                          <td className="px-3 py-2 text-xs">{r.user_email}</td>
                          <td className="px-3 py-2 text-xs">
                            {r.contrato_id ? (
                              <Link
                                to={`/analisis/${r.contrato_id}`}
                                className="text-teal-600 hover:underline dark:text-teal-400"
                              >
                                {r.titulo || `#${r.contrato_id}`}
                              </Link>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                            {r.tipo_respuesta && (
                              <span className="mt-0.5 block text-slate-500">
                                {TIPO_LABEL[r.tipo_respuesta as TipoRespuesta] ?? r.tipo_respuesta}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{r.tokens_total > 0 ? fmtNum(r.tokens_total) : '—'}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmtUsd(r.costo_usd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Cupos y caché ───────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium">Cupos y caché (hoy UTC)</h2>
        <p className="text-sm text-slate-500">
          Contadores diarios del Worker (KV). El detalle de quién gastó, en qué
          proyecto y a qué hora está en la sección de consumo de IA de arriba.
        </p>
        {statsErr && <ErrorBox retry={() => void loadStats()}>{statsErr}</ErrorBox>}
        {statsLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : stats ? (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
                <tr>
                  <th className="px-3 py-2 font-medium">Métrica</th>
                  <th className="px-3 py-2 font-medium">Clave KV</th>
                  <th className="px-3 py-2 font-medium">Hoy</th>
                </tr>
              </thead>
              <tbody>
                {kvRows.map((r) => (
                  <tr key={r.clave} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="px-3 py-2">{r.label}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-500">{r.clave}</td>
                    <td className="px-3 py-2 tabular-nums">{r.valor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {/* ── Postulables sin intento ──────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Postulables sin intento de descarga</h2>
          <button
            onClick={() => {
              setSinSoloTi((v) => !v)
              setSinPage(0)
            }}
            className={
              sinSoloTi
                ? 'rounded-lg bg-teal-600 px-2.5 py-1 text-xs font-medium text-white'
                : 'rounded-lg border border-slate-300 px-2.5 py-1 text-xs dark:border-slate-700'
            }
          >
            Solo rubro TI
          </button>
        </div>
        <p className="text-sm text-slate-500">
          Ventana abierta, sin <span className="font-mono text-xs">pdf_storage_path</span> y
          sin <span className="font-mono text-xs">req_url</span>: el sistema los ve pero
          nunca intentó bajar el TDR, así que no pueden analizarse. El rubro (Núcleo,
          Adyacente, Oportunista, Marginal) te dice cuáles importan para tu negocio.
        </p>
        {sinIntentoErr && (
          <ErrorBox retry={() => void loadSinIntento()}>{sinIntentoErr}</ErrorBox>
        )}
        {sinIntentoLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : !sinIntento ? (
          sinIntentoErr ? null : (
            <EmptyState title="Sin dato" hint="No se pudo leer fn_sin_intento." />
          )
        ) : sinIntento.total === 0 ? (
          <EmptyState
            title="Ninguno pendiente"
            hint="Todos los postulables con ventana abierta ya tienen intento de descarga."
          />
        ) : (
          <>
            {/* Resumen por rubro */}
            <div className="flex flex-wrap gap-2">
              {sinIntento.resumen.map((r) => {
                const meta = RUBRO_META[r.rubro] ?? RUBRO_META.sin_clasificar
                return (
                  <button
                    key={r.rubro}
                    onClick={() => {
                      setSinSoloTi(r.rubro !== 'sin_clasificar')
                      setSinPage(0)
                    }}
                    className="flex items-center gap-2 rounded-full border border-slate-200 px-2.5 py-1 text-xs dark:border-slate-800"
                    title={meta.desc}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} />
                    <span>{meta.label}</span>
                    <span className="font-semibold tabular-nums">{r.n}</span>
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-slate-500">
              {fmtNum(sinIntento.total)} en total · {fmtNum(sinIntento.total_ti)} con rubro TI ·{' '}
              página {sinPage + 1} de {totalPaginas}
            </p>
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
                  <tr>
                    <th className="px-3 py-2 font-medium">Rubro</th>
                    <th className="px-3 py-2 font-medium">Título</th>
                    <th className="px-3 py-2 font-medium">Entidad</th>
                    <th className="px-3 py-2 font-medium">Cierra</th>
                  </tr>
                </thead>
                <tbody>
                  {sinIntento.rows.map((c) => (
                    <tr key={c.id} className="border-t border-slate-200 dark:border-slate-800">
                      <td className="px-3 py-2">
                        <RubroChip rubro={c.rubro} />
                        {c.categoria_it && (
                          <span className="mt-1 block text-xs text-slate-500">{labelCat(c.categoria_it)}</span>
                        )}
                        {c.relevancia_ia === 'ALTA' && (
                          <span className="mt-1 inline-block rounded-full bg-red-500/15 px-1.5 py-0.5 text-xs text-red-600 dark:text-red-400">
                            IA alta
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Link
                          to={`/analisis/${c.id}`}
                          className="font-medium text-teal-600 hover:underline dark:text-teal-400"
                        >
                          {c.titulo || `Contrato ${c.id}`}
                        </Link>
                        {c.nro && (
                          <span className="mt-0.5 block font-mono text-xs text-slate-500">{c.nro}</span>
                        )}
                        {c.objeto && (
                          <span className="mt-0.5 block text-xs text-slate-500">{c.objeto}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <span className="block">{c.entidad ?? '—'}</span>
                        {c.entidad && (
                          <span className="block text-slate-500">{tipoEntidad(c.entidad)}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {c.urgente && (
                          <span className="mr-1 rounded-full bg-red-500/15 px-1.5 py-0.5 text-xs text-red-600 dark:text-red-400">
                            ¡urgente!
                          </span>
                        )}
                        {c.dias != null ? (
                          <span>
                            {c.dias <= 0 ? 'hoy' : `en ${c.dias} d`}
                            <span className="ml-1 text-xs text-slate-500">{fmtTs(c.fecha_fin_cotizacion)}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">sin fecha</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-2 text-xs">
              <button
                disabled={sinPage === 0}
                onClick={() => setSinPage((p) => Math.max(0, p - 1))}
                className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40 dark:border-slate-700"
              >
                ← Anterior
              </button>
              <span className="text-slate-500">
                {fmtNum(sinIntento.offset + 1)}–{fmtNum(Math.min(sinIntento.offset + sinIntento.rows.length, sinIntento.total))} de {fmtNum(sinIntento.total)}
              </span>
              <button
                disabled={sinPage >= totalPaginas - 1}
                onClick={() => setSinPage((p) => p + 1)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40 dark:border-slate-700"
              >
                Siguiente →
              </button>
            </div>
          </>
        )}
      </section>

      {/* ── Catálogo CUBSO ───────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium">Catálogo CUBSO</h2>
        {cubsoErr && <ErrorBox retry={() => void loadCubso()}>{cubsoErr}</ErrorBox>}
        {cubsoLoading ? (
          <Skeleton className="h-28 w-full" />
        ) : !cubso ? (
          cubsoErr ? null : (
            <EmptyState
              title="Sin versión cargada"
              hint="scripts/cargar_cubso.py escribe cubso_version (id=1)."
            />
          )
        ) : (
          <CubsoCard
            version={cubso.version_catalogo}
            items={cubso.items}
            cargado={cubso.cargado_utc}
          />
        )}
      </section>

      {/* ── Seguimiento por contrato (pipeline de IA) ─────────────────── */}
      <SeguimientoContrato />
    </div>
  )
}

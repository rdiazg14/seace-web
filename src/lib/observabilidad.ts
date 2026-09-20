import { useEffect, useMemo, useState } from 'react'
import { AI_PROXY, supabase } from './supabase'
import { useAuth } from './auth'
import { useTheme } from './theme'

export const TIPOS = ['texto', 'tabla', 'grafica', 'tabla_grafica'] as const
export type TipoRespuesta = (typeof TIPOS)[number]

export const TIPO_LABEL: Record<TipoRespuesta, string> = {
  texto: 'Texto',
  tabla: 'Tabla',
  grafica: 'Gráfica',
  tabla_grafica: 'Tabla + gráfica',
}

export interface LastError {
  status: number | null
  body: string
  timestamp: string | null
  source?: string | null
}

export interface TokenExpira {
  expira: string
  leido_utc: string
  source?: string | null
}

/** Fila de fn_sin_intento() (con rubro y semántica). */
export interface SinIntentoRow {
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

export interface SinIntentoData {
  total: number
  total_ti: number
  resumen: Array<{ rubro: string; n: number }>
  page_size: number
  offset: number
  rows: SinIntentoRow[]
}

export interface AdminStats {
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

export const TRIGGER_STALE_MS = 36 * 60 * 60 * 1000

/** Respuesta de fn_uso_ia_stats(): traza unificada de consumo por componente. */
export interface UsoIaStats {
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

export const COMPONENTE_LABEL: Record<string, string> = {
  chat: 'Chat RAG',
  cotizar: 'Cotizar',
  analizar: 'Analizar',
  ocr: 'OCR',
  embedding: 'Embeddings',
  clasificar: 'Clasificación',
  query_rewrite: 'Reescritura de query',
}

export const COMPONENTE_COLOR: Record<string, string> = {
  chat: '#14B8A6',
  cotizar: '#6366F1',
  analizar: '#0EA5E9',
  ocr: '#F59E0B',
  embedding: '#8B5CF6',
  clasificar: '#EC4899',
  query_rewrite: '#A3E635',
}

export const RUBRO_META: Record<string, { label: string; color: string; desc: string }> = {
  nucleo: { label: 'Núcleo', color: '#14B8A6', desc: 'Foco principal (IA, cloud, software, telemetría)' },
  adyacente: { label: 'Adyacente', color: '#0EA5E9', desc: 'Cercano (BD/ERP, Oracle)' },
  oportunista: { label: 'Oportunista', color: '#F59E0B', desc: 'Ocasional (soporte, redes, licencias, seguridad…)' },
  marginal: { label: 'Marginal', color: '#94A3B8', desc: 'Hardware u otros' },
  sin_clasificar: { label: 'Sin rubro TI', color: '#64748B', desc: 'Sin categoría IT ni relevancia IA' },
}

export function fmtUsd(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n <= 0) return '$0.00'
  if (n < 0.01) return '<$0.01'
  return `$${n.toFixed(3).replace(/\.?0+$/, '')}`
}

export function fmtNum(n: number): string {
  return n.toLocaleString('es-PE')
}

export function fmtTs(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('es-PE')
}

export function fmtDate(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(d.getTime())) return isoDate
  return d.toLocaleDateString('es-PE', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function diasDesde(isoDate: string): number {
  const d = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(d.getTime())) return 0
  const hoy = new Date()
  const utcHoy = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  const utcVer = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.floor((utcHoy - utcVer) / 86_400_000)
}

export function diasHasta(isoDate: string): number {
  const d = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(d.getTime())) return 0
  const hoy = new Date()
  const utcHoy = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  const utcVer = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.round((utcVer - utcHoy) / 86_400_000)
}

export function localIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function isoDiasAtras(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return localIso(d)
}

export const SIN_PAGE = 25

export function useObservabilidad() {
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

  return {
    axis,
    grid,
    tipBg,
    tipFg,
    stats,
    statsErr,
    statsLoading,
    loadStats,
    cubso,
    cubsoErr,
    cubsoLoading,
    loadCubso,
    uso,
    usoErr,
    usoLoading,
    usoDesde,
    usoHasta,
    modeloFiltro,
    compFiltro,
    modelos,
    setUsoDesde,
    setUsoHasta,
    setModeloFiltro,
    setCompFiltro,
    loadUso,
    sinIntento,
    sinIntentoErr,
    sinIntentoLoading,
    sinPage,
    sinSoloTi,
    setSinPage,
    setSinSoloTi,
    loadSinIntento,
    lastErr,
    lastOk,
    tokenExpira,
    diasToken,
    triggerStale,
    triggerSinOk,
    tokenCls,
    kvRows,
    compBars,
    donut,
    totalPaginas,
  }
}

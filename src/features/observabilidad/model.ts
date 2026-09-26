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

export function diasDesde(isoDate: string, ahora: Date = new Date()): number {
  const d = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(d.getTime())) return 0
  const utcHoy = Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
  const utcVer = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.floor((utcHoy - utcVer) / 86_400_000)
}

export function diasHasta(isoDate: string, ahora: Date = new Date()): number {
  const d = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(d.getTime())) return 0
  const utcHoy = Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
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

export interface EstadoTrigger {
  lastErr: LastError | null
  lastOk: LastError | null
  tokenExpira: TokenExpira | null
  diasToken: number | null
  triggerStale: boolean
  triggerSinOk: boolean
  tokenCls: string
}

const TOKEN_CLS_BASE = 'rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800'
const TOKEN_CLS_ALERTA = 'rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300'
const TOKEN_CLS_AVISO = 'rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300'

/** Deriva el estado del pipeline-trigger y del PAT a partir de los contadores KV. */
export function estadoTrigger(stats: AdminStats | null, ahora: number = Date.now()): EstadoTrigger {
  const lastErr = stats?.kv.pipeline_trigger_last_error ?? null
  const lastOk = stats?.kv.pipeline_trigger_last_ok ?? null
  const tokenExpira = stats?.kv.pipeline_trigger_token_expira ?? null
  const diasToken = tokenExpira ? diasHasta(tokenExpira.expira, new Date(ahora)) : null
  const lastOkMs = lastOk?.timestamp ? Date.parse(lastOk.timestamp) : NaN
  const lastOkAgeMs = Number.isFinite(lastOkMs) ? ahora - lastOkMs : null
  const triggerStale = lastOkAgeMs != null && lastOkAgeMs > TRIGGER_STALE_MS
  const triggerSinOk = Boolean(stats) && !lastOk

  let tokenCls = TOKEN_CLS_BASE
  if (diasToken !== null && diasToken < 7) {
    tokenCls = TOKEN_CLS_ALERTA
  } else if (diasToken !== null && diasToken < 14) {
    tokenCls = TOKEN_CLS_AVISO
  }

  return { lastErr, lastOk, tokenExpira, diasToken, triggerStale, triggerSinOk, tokenCls }
}

export interface KvFila {
  clave: string
  label: string
  valor: number
}

/** Filas de la tabla "Cupos y caché" a partir de los contadores KV del día. */
export function filasKv(stats: AdminStats | null): KvFila[] {
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
}

export interface BarraComponente {
  label: string
  Prompt: number
  Completion: number
}

/** Barras apiladas prompt/completion por componente. */
export function barrasComponente(uso: UsoIaStats | null): BarraComponente[] {
  if (!uso) return []
  return uso.por_componente.map((c) => ({
    label: COMPONENTE_LABEL[c.componente] ?? c.componente,
    Prompt: c.tokens_prompt,
    Completion: c.tokens_completion,
  }))
}

export interface PuntoDonut {
  name: string
  value: number
  color: string
  pct: number
}

/** Donut de costo por componente; descarta componentes sin costo. */
export function donutCosto(uso: UsoIaStats | null): PuntoDonut[] {
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
}

export function totalPaginasSinIntento(sinIntento: SinIntentoData | null): number {
  return sinIntento ? Math.max(1, Math.ceil(sinIntento.total / SIN_PAGE)) : 1
}

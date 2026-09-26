// Lógica pura del asistente de escenarios/cotización (sin JSX ni hooks):
// datos, parseo SSE, interpretación de respuestas de /cotizar, precios y
// persistencia. El hook useAsistente la compone y components/ la presenta.

import type { EscenarioPayload, ChatTabla, ChatGrafica } from '../../../lib/analisis'
import { escenarioMuestraCifras } from '../../../lib/analisis'
import type { MensajeChat } from '../../../lib/chatSesiones'
import { eventosSse } from '../../../lib/sse'

export const CHIPS_ESCENARIO = [
  'instancias más chicas',
  '¿y si subo al techo S/40k?',
  'subcontratar la nube',
]

export const HISTORY_MAX_ITEMS = 8
export const HISTORY_MAX_CHARS = 500
export const STREAM_REVEAL_MS = 180

export interface EscenaClasificacion {
  necesita_internet: boolean
}

export interface UsoTokens {
  prompt: number
  completion: number
  cached?: number
  thoughts?: number
  total?: number
}

/** Metadatos de la respuesta de Gemini (finish reason, versión, latencia, etc.). */
export interface GeminiMeta {
  finishReason?: string
  modelVersion?: string
  responseId?: string
  serviceTier?: string
  thinkingLevel?: string
  latencyMs?: number
}

export interface WebSource {
  uri: string
  title: string
}

export interface EscenaMsg {
  id?: string
  role: 'user' | 'bot'
  text: string
  type?: 'error'
  escenario?: EscenarioPayload | null
  clasificacion?: EscenaClasificacion
  error?: boolean
  limit?: boolean
  aviso?: boolean
  query?: string
  streaming?: boolean
  progress?: boolean
  phase?: 'clasificar' | 'contexto' | 'redactar'
  streamText?: string
  /** Texto SSE acumulado antes del reveal (B5: colapsar antes de mostrar). */
  streamBuffer?: string
  /** Tokens de la generación (prompt + completion), si el backend los devolvió. */
  usage?: UsoTokens | null
  /** Razonamiento interno del modelo (thinking), colapsado con icono de cerebro. */
  thought?: string | null
  /** True mientras el razonamiento se está revelando en vivo (SSE) y debe verse expandido. */
  thoughtStreaming?: boolean
  /** Modelo que generó la respuesta. */
  model?: string
  /** ID de request (para copiar/reportar). */
  requestId?: string
  /** Metadatos extra de Gemini (finish reason, versión, latencia, tier). */
  meta?: GeminiMeta | null
  /** Fuentes web (grounding) cuando se usó búsqueda en internet. */
  webSources?: WebSource[]
}

export type CotizarSseEvent = {
  type?: string
  phase?: string
  message?: string
  token?: string
  escenario?: EscenarioPayload
  clasificacion?: unknown
  usage?: UsoTokens | null
  thought?: string | null
  model?: string
  meta?: GeminiMeta | null
  models?: string[]
  request_id?: string
  web_sources?: WebSource[]
  consumido_usd?: number
  presupuesto_usd?: number | null
  saldo_usd?: number | null
}

export function parseClasificacion(raw: unknown): EscenaClasificacion | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  return { necesita_internet: o.necesita_internet === true }
}

export function newMsgId(): string {
  return crypto.randomUUID()
}

/** Serializa el estado rico de un mensaje bot para guardar en chat_mensajes.payload. */
export function payloadBot(m: EscenaMsg): Record<string, unknown> | null {
  if (m.role !== 'bot') return null
  return {
    escenario: m.escenario ?? null,
    clasificacion: m.clasificacion ?? null,
    thought: m.thought ?? null,
    model: m.model ?? null,
    request_id: m.requestId ?? null,
    usage: m.usage ?? null,
    meta: m.meta ?? null,
    web_sources: m.webSources ?? null,
  }
}

/** Reconstruye un EscenaMsg desde una fila persistida de chat_mensajes. */
export function msgDesdeFila(m: MensajeChat): EscenaMsg {
  if (m.rol === 'user') {
    return { id: newMsgId(), role: 'user', text: m.texto }
  }
  const base: EscenaMsg = {
    id: newMsgId(),
    role: 'bot',
    text: m.texto,
    error: m.error,
    limit: m.limit_flag,
  }
  const p = m.payload
  if (p && typeof p === 'object') {
    const escenario = p.escenario ? hydrateEscenario(p.escenario) : null
    base.escenario = escenario
    base.clasificacion = (p.clasificacion && typeof p.clasificacion === 'object')
      ? p.clasificacion as EscenaClasificacion
      : undefined
    base.thought = typeof p.thought === 'string' ? p.thought : null
    base.model = typeof p.model === 'string' ? p.model : undefined
    base.requestId = typeof p.request_id === 'string' ? p.request_id : undefined
    base.usage = (p.usage && typeof p.usage === 'object') ? p.usage as UsoTokens : null
    base.meta = (p.meta && typeof p.meta === 'object') ? p.meta as GeminiMeta : null
    base.webSources = Array.isArray(p.web_sources) ? p.web_sources as WebSource[] : undefined
    if (escenario && !base.error && !base.limit) {
      base.progress = true
      base.phase = 'redactar'
      base.streamText = escenario.escenario
    }
  }
  return base
}

// Precio USD por 1M tokens (input, output). Debe coincidir con el Worker.
export const MODEL_PRECIOS: Record<string, { input: number; output: number }> = {
  'gemini-3.7-flash': { input: 0.75, output: 3.75 },
  'gemini-3.6-flash': { input: 0.75, output: 3.75 },
  'gemini-3.1-flash-lite': { input: 0.25, output: 1.5 },
  'gemini-3.1-pro-preview': { input: 2, output: 12 },
}

export const MODEL_LABELS: Record<string, string> = {
  'gemini-3.7-flash': '3.7 Flash',
  'gemini-3.6-flash': '3.6 Flash',
  'gemini-3.1-flash-lite': '3.1 Flash-Lite',
  'gemini-3.1-pro-preview': '3.1 Pro',
}

export function labelModelo(m: string | null | undefined): string {
  if (!m) return ''
  return MODEL_LABELS[m] ?? m
}

export function usoTokensTotal(u: UsoTokens | null | undefined): number {
  return u ? u.prompt + u.completion + (u.thoughts ?? 0) : 0
}

export function costoUsd(u: UsoTokens | null | undefined, model?: string | null): number {
  if (!u) return 0
  const p = MODEL_PRECIOS[model ?? ''] ?? MODEL_PRECIOS['gemini-3.1-flash-lite']
  const outputTokens = u.completion + (u.thoughts ?? 0)
  return (u.prompt / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output
}

export function fmtCostoUsd(n: number): string {
  if (n <= 0) return '$0.00'
  if (n < 0.01) return '<$0.01'
  return `$${n.toFixed(3).replace(/\.?0+$/, '')}`
}

export function fmtUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  const sign = n < 0 ? '-' : ''
  return `${sign}$${Math.abs(n).toFixed(2)}`
}

export function hayMontosReales(e: EscenarioPayload): boolean {
  return e.valor_estimado_soles != null
}

export function cambioRelevante(s?: string): string {
  const t = (s || '').trim()
  if (!t || /^(ninguno|ninguna|n\/a|n\.?a\.?|sin cambios?|no (hay|aplica)|—|-)$/i.test(t)) return ''
  return t
}

export const ANALISIS_PHASES: { id: NonNullable<EscenaMsg['phase']>; label: string }[] = [
  { id: 'clasificar', label: 'Clasificando tu pregunta...' },
  { id: 'contexto', label: 'Recuperando contexto del contrato...' },
  { id: 'redactar', label: 'Redactando respuesta...' },
]

/** Eventos de /cotizar; un error del manejador no interrumpe la lectura (contrato histórico). */
export async function readSseEvents(
  res: Response,
  onEvent: (ev: CotizarSseEvent) => void,
): Promise<void> {
  for await (const ev of eventosSse(res, { flushTail: true })) {
    try {
      onEvent(ev as CotizarSseEvent)
    } catch {
      /* chunk parcial */
    }
  }
}

export function buildEscenaHistory(messages: EscenaMsg[]): { role: 'user' | 'bot'; text: string }[] {
  const out: { role: 'user' | 'bot'; text: string }[] = []
  for (const m of messages) {
    if (m.error || m.limit || m.aviso) continue
    if (m.role === 'bot' && !m.text.trim()) continue
    out.push({ role: m.role, text: m.text.slice(0, HISTORY_MAX_CHARS) })
  }
  return out.slice(-HISTORY_MAX_ITEMS)
}

export function botHistoryText(e: EscenarioPayload): string {
  const tipo = e.tipo_respuesta || 'texto'
  const head = e.escenario.replace(/\s+/g, ' ').slice(0, 280)
  if (!escenarioMuestraCifras(e)) {
    return `[${tipo}] ${head}`
  }
  return `[${tipo}] ${head}. Asumiendo: ${e.supuestos_aplicados.join('; ')}`
}

export function tablaValida(t: ChatTabla | null | undefined): t is ChatTabla {
  return Boolean(t && Array.isArray(t.columnas) && t.columnas.length && Array.isArray(t.filas) && t.filas.length)
}

export function graficaValida(g: ChatGrafica | null | undefined): g is ChatGrafica {
  return Boolean(g && Array.isArray(g.datos) && g.datos.some(d => d && typeof d.valor === 'number'))
}

export function hydrateEscenario(raw: unknown): EscenarioPayload | null {
  if (!raw || typeof raw !== 'object') return null
  const e = raw as EscenarioPayload
  if (e.tabla && Array.isArray(e.tabla.filas)) {
    e.tabla = {
      ...e.tabla,
      filas: e.tabla.filas.map((row) => {
        if (Array.isArray(row)) return row.map((c) => (c == null ? '' : String(c)))
        if (row && typeof row === 'object' && Array.isArray((row as { celdas?: unknown }).celdas)) {
          return (row as { celdas: unknown[] }).celdas.map((c) => (c == null ? '' : String(c)))
        }
        return []
      }),
    }
  }
  return e
}

/** Respuesta JSON de /cotizar (éxito, límite, sin análisis o fallo por capa). */
export type CotizarJson = {
  escenario?: EscenarioPayload
  clasificacion?: unknown
  status?: string
  mensaje?: string
  error?: string
  layer?: string
  respuesta?: string
  usage?: UsoTokens | null
  thought?: string | null
  model?: string
  meta?: GeminiMeta | null
  models?: string[]
  request_id?: string
  web_sources?: WebSource[]
  consumido_usd?: number
  presupuesto_usd?: number | null
  saldo_usd?: number | null
}

/** Mensaje del bot con el escenario final (JSON o evento `data`). */
export function escenarioListo(prev: EscenaMsg, p: CotizarJson | CotizarSseEvent, e: EscenarioPayload): EscenaMsg {
  return {
    ...prev,
    streaming: false,
    progress: true,
    text: botHistoryText(e),
    escenario: e,
    clasificacion: parseClasificacion(p.clasificacion),
    streamText: e.escenario,
    streamBuffer: undefined,
    usage: p.usage ?? null,
    thought: p.thought ?? null,
    model: p.model,
    meta: p.meta ?? null,
    requestId: p.request_id,
    webSources: p.web_sources ?? [],
  }
}

/** Mensaje del bot para un fallo controlado (sin escenario ni streaming). */
export function falloBot(prev: EscenaMsg, text: string, extra: Partial<EscenaMsg> = {}): EscenaMsg {
  return {
    ...prev,
    role: 'bot',
    text,
    streaming: false,
    progress: false,
    streamText: '',
    streamBuffer: undefined,
    escenario: null,
    ...extra,
  }
}

export type ResultadoCotizarJson =
  | { kind: 'fallo'; text: string; extra: Partial<EscenaMsg> }
  | { kind: 'ok'; escenario: EscenarioPayload }
  | { kind: 'excepcion'; message: string }

/** Interpreta una respuesta JSON de /cotizar (no SSE o no exitosa). */
export function interpretarCotizarJson(status: number, ok: boolean, payload: CotizarJson, query: string): ResultadoCotizarJson {
  if (status === 502) {
    const capa = payload.layer === 'gemini'
      ? 'El servicio de IA (Gemini) no respondió correctamente.'
      : payload.layer === 'supabase'
        ? 'No se pudo leer el análisis desde la base de datos.'
        : 'El servicio no respondió correctamente.'
    return { kind: 'fallo', text: `${capa} Podés reintentar la misma pregunta.`, extra: { type: 'error', error: true, query } }
  }
  if (status === 409 && payload.status === 'sin_analisis') {
    return {
      kind: 'fallo',
      text: payload.mensaje || 'Analizá el contrato primero. Recargá esta página y esperá a que termine el análisis.',
      extra: { aviso: true },
    }
  }
  if (status === 429 || status === 503
    || payload.error === 'rate_limited'
    || payload.error === 'daily_limited'
    || payload.error === 'over_capacity') {
    return {
      kind: 'fallo',
      text: payload.respuesta || payload.mensaje
        || (status === 503
          ? 'Hay alta demanda en el asistente. Intenta más tarde.'
          : 'Has hecho demasiadas consultas. Espera un minuto e intenta de nuevo.'),
      extra: { limit: true },
    }
  }
  if (!ok || !payload.escenario) {
    return { kind: 'excepcion', message: payload.respuesta || payload.error || `HTTP ${status}` }
  }
  return { kind: 'ok', escenario: hydrateEscenario(payload.escenario) ?? payload.escenario }
}

/** Texto visible para un evento `error` del stream de /cotizar. */
export function mensajeErrorStream(message?: string): string {
  return message && /gemini|HTTP 5\d\d/i.test(message)
    ? 'El servicio no respondió correctamente. Podés reintentar la misma pregunta.'
    : (message || 'No pude recalcular el escenario')
}

/** Mueve el texto retenido al texto visible (revelado diferido del primer bloque). */
export function revelarBuffer(prev: EscenaMsg): EscenaMsg {
  if (!prev.streamBuffer) return prev
  return { ...prev, streamText: (prev.streamText || '') + prev.streamBuffer, streamBuffer: undefined }
}

export interface EfectoEvento {
  msg: EscenaMsg
  /** El primer texto se retiene y se revela tras STREAM_REVEAL_MS. */
  programarRevelado: boolean
  /** Evento `data`: cancelar el revelado pendiente y aplicar metadatos globales. */
  datos: CotizarSseEvent | null
  error: string | null
}

/** Aplica un evento SSE de /cotizar al mensaje del bot en curso. */
export function aplicarEventoCotizar(prev: EscenaMsg, ev: CotizarSseEvent): EfectoEvento {
  const base: EfectoEvento = { msg: prev, programarRevelado: false, datos: null, error: null }
  if (ev.type === 'phase') {
    const phase = ev.phase === 'contexto' || ev.phase === 'redactar' || ev.phase === 'clasificar'
      ? ev.phase
      : 'clasificar'
    return { ...base, msg: { ...prev, phase } }
  }
  if (ev.type === 'thought' && ev.token) {
    return { ...base, msg: { ...prev, thought: (prev.thought || '') + ev.token, thoughtStreaming: true } }
  }
  if (ev.type === 'thought_done') {
    return { ...base, msg: { ...prev, thoughtStreaming: false } }
  }
  if (ev.type === 'text' && ev.token) {
    if (!prev.streamText) {
      return { ...base, programarRevelado: true, msg: { ...prev, streamBuffer: (prev.streamBuffer || '') + ev.token } }
    }
    return { ...base, msg: { ...prev, streamText: (prev.streamText || '') + ev.token } }
  }
  if (ev.type === 'data' && ev.escenario) {
    const e = hydrateEscenario(ev.escenario) ?? ev.escenario
    return { ...base, datos: ev, msg: escenarioListo(revelarBuffer(prev), ev, e) }
  }
  if (ev.type === 'error') return { ...base, error: mensajeErrorStream(ev.message) }
  return base
}

/** Tokens acumulados de la sesión (mensajes previos + respuesta nueva) para chat_sesiones. */
export function tokensSesion(previos: EscenaMsg[], nuevo: EscenaMsg): { prompt: number; completion: number } {
  const acu = { prompt: 0, completion: 0 }
  for (const m of previos) {
    if (m.role === 'bot' && m.usage) {
      acu.prompt += m.usage.prompt
      acu.completion += m.usage.completion
    }
  }
  acu.prompt += nuevo.usage?.prompt ?? 0
  acu.completion += nuevo.usage?.completion ?? 0
  return acu
}

/**
 * Estado y reglas puras del chat RAG general (/chat): historial enviado al
 * proxy, mensajes de límite, eventos SSE y construcción de la respuesta.
 * Sin React, red ni Supabase.
 */

import type { Contrato, ContratoRef } from '../../types'

export const SUGERENCIAS = [
  'ciberseguridad',
  'servicios contables',
  'equipos de cómputo',
  'cloud o servicios en la nube',
]

export const BIENVENIDA =
  'Soy el asistente SEACE con IA. Busco en los Términos de Referencia reales de los contratos vigentes. Pregúntame sobre requisitos técnicos, especificaciones, plazos o cualquier detalle.'

export const CONTEXTO_LIMITE = 1_000_000

const HISTORY_MAX_ITEMS = 8
const HISTORY_MAX_CHARS = 500

export interface Uso {
  prompt: number
  completion: number
}

export interface WebSource {
  uri: string
  title: string
}

export interface ChatMsg {
  role: 'user' | 'bot'
  text: string
  refs?: ContratoRef[]
  contratos?: Contrato[]
  webSources?: WebSource[]
  error?: boolean
  limit?: boolean
  stage?: string
  query?: string
  tokens_prompt?: number
  tokens_completion?: number
}

/** Cuerpo de error del proxy (límites, fallos). */
export interface ErrorProxy {
  respuesta?: string
  response?: string
  error?: string
}

/** Respuesta JSON del proxy (sin SSE). */
export interface RespuestaJson extends ErrorProxy {
  contratos_referenciados?: ContratoRef[]
  usage?: Uso
  web_sources?: WebSource[]
}

/** Evento SSE del chat (`stage`). */
export interface EventoChat {
  stage?: string
  message?: string
  token?: string
  chunks?: number
  contratos_referenciados?: ContratoRef[]
  usage?: Uso
  web_sources?: WebSource[]
}

/** Últimos 4 pares para el Worker. El embed/RAG solo ven `query`; el history no resuelve "ese contrato". */
export function buildChatHistory(messages: ChatMsg[]): { role: 'user' | 'bot'; text: string }[] {
  const out: { role: 'user' | 'bot'; text: string }[] = []
  for (const m of messages) {
    if (m.error || m.limit) continue
    if (m.role === 'bot' && !m.text.trim()) continue
    out.push({ role: m.role, text: m.text.slice(0, HISTORY_MAX_CHARS) })
  }
  return out.slice(-HISTORY_MAX_ITEMS)
}

export function mensajeLimite(status: number, data: ErrorProxy): string {
  const fromWorker = data.respuesta || data.response
  if (fromWorker) return fromWorker
  if (status === 429 || data.error === 'rate_limited') {
    return 'Has hecho demasiadas consultas. Espera un minuto e intenta de nuevo.'
  }
  if (data.error === 'daily_limited') {
    return 'Llegaste al límite diario de consultas desde esta red. Intenta mañana.'
  }
  if (status === 503 || data.error === 'over_capacity') {
    return 'Hay alta demanda en el asistente. Intenta más tarde.'
  }
  if (status === 502) {
    return 'El servicio no respondió correctamente. Podés reintentar la misma pregunta.'
  }
  return 'No pude consultar la IA ahora. Prueba de nuevo o usa el buscador.'
}

/** Mensaje del bot ante una respuesta HTTP no exitosa: límite (ámbar) o error (rojo, reintentable). */
export function mensajeHttpFallido(status: number, data: ErrorProxy, query: string): ChatMsg {
  const isLimit = status === 429 || status === 503
    || data.error === 'rate_limited'
    || data.error === 'daily_limited'
    || data.error === 'over_capacity'
  return { role: 'bot', text: mensajeLimite(status, data), error: !isLimit, limit: isLimit, query }
}

/** Mensaje del bot ante fallo de red o cancelación. */
export function mensajeConexionFallida(abortado: boolean, query: string): ChatMsg {
  return {
    role: 'bot',
    text: abortado
      ? 'La conexión se interrumpió. Puedes reintentar la misma pregunta.'
      : 'No pude consultar la IA ahora. Prueba de nuevo o usa el buscador.',
    error: true,
    query,
  }
}

export function composeRagPrefill(q: string, nro: string, titulo: string, cat: string | null): string {
  let ctx = nro ? `${nro} — ${titulo}` : titulo
  if (cat) ctx += ` · ${cat}`
  return ctx ? `[Contexto: ${ctx}] ${q}` : q
}

export function hace(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ''
  const diff = now - t
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.floor(h / 24)
  return `hace ${d} d`
}

/** Acumulado de un stream SSE en curso. */
export interface StreamChat {
  text: string
  refs: ContratoRef[]
  web: WebSource[]
  usage: Uso
}

export const STREAM_INICIAL: StreamChat = { text: '', refs: [], web: [], usage: { prompt: 0, completion: 0 } }

/**
 * Aplica un evento SSE: devuelve el nuevo acumulado y el parche visible del
 * último mensaje. Un evento `error` se reporta en `error` para que el hook lo lance.
 */
export function aplicarEventoChat(
  s: StreamChat,
  ev: EventoChat,
  query: string,
): { s: StreamChat; patch: Partial<ChatMsg> | null; error: string | null } {
  if (ev.stage === 'searching') {
    return { s, patch: { stage: ev.message || 'Buscando en los TDR…', query }, error: null }
  }
  if (ev.stage === 'found') {
    return {
      s,
      patch: {
        stage: ev.message || (ev.chunks != null
          ? `Encontré ${ev.chunks} fragmentos relevantes`
          : 'Encontré fragmentos relevantes'),
        query,
      },
      error: null,
    }
  }
  if (ev.stage === 'streaming' && ev.token) {
    const text = s.text + ev.token
    return { s: { ...s, text }, patch: { text, stage: 'Redactando la respuesta…', query }, error: null }
  }
  if (ev.stage === 'done') {
    return {
      s: {
        ...s,
        refs: ev.contratos_referenciados ?? [],
        web: ev.web_sources ?? [],
        usage: ev.usage ?? { prompt: 0, completion: 0 },
      },
      patch: null,
      error: null,
    }
  }
  if (ev.stage === 'error') return { s, patch: null, error: ev.message || 'error SSE' }
  return { s, patch: null, error: null }
}

/** Mensaje final tras un stream completo. */
export function mensajeDesdeStream(s: StreamChat, contratos: Contrato[], query: string): ChatMsg {
  return {
    role: 'bot',
    text: s.text.trim() ? s.text : 'No pude generar una respuesta.',
    refs: s.refs,
    contratos,
    webSources: s.web,
    query,
    tokens_prompt: s.usage.prompt,
    tokens_completion: s.usage.completion,
  }
}

/** Mensaje final desde una respuesta JSON (el proxy responde 200 incluso con `error`). */
export function mensajeDesdeJson(data: RespuestaJson, contratos: Contrato[], query: string): ChatMsg {
  return {
    role: 'bot',
    text: data.respuesta || data.response || 'No pude generar una respuesta.',
    refs: data.contratos_referenciados ?? [],
    contratos,
    webSources: data.web_sources ?? [],
    error: Boolean(data.error),
    query,
    tokens_prompt: data.usage?.prompt ?? 0,
    tokens_completion: data.usage?.completion ?? 0,
  }
}

/** Tokens del último prompt enviado y porcentaje de la ventana de contexto. */
export function usoContexto(messages: ChatMsg[]): { lastPrompt: number; pct: number } {
  let lastPrompt = 0
  for (let i = messages.length - 1; i >= 0; i--) {
    const tp = messages[i].tokens_prompt
    if (tp) {
      lastPrompt = tp
      break
    }
  }
  const pct = lastPrompt ? Math.min(100, Math.round((lastPrompt / CONTEXTO_LIMITE) * 1000) / 10) : 0
  return { lastPrompt, pct }
}

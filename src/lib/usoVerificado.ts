import { supabase } from './supabase'

/**
 * Uso de IA medido y escrito por el servidor en `uso_ia` (SEC-006). El navegador
 * solo puede leer sus propias filas (RLS) y nunca escribirlas: lo que un mensaje
 * guarda en `chat_mensajes` es una copia declarada; esto es la fuente verificada.
 */
export interface UsoVerificado {
  prompt: number
  completion: number
  thoughts: number
  cached: number
  /** null = el servidor no conoce el costo (precio o consumo desconocido). */
  costoUsd: number | null
  modelo: string | null
  latenciaMs: number | null
  resultado: string | null
}

type FilaUso = {
  request_id: string | null
  modelo: string | null
  tokens_prompt: number | null
  tokens_completion: number | null
  tokens_thoughts: number | null
  tokens_cached: number | null
  costo_usd: number | string | null
  latencia_ms: number | null
  resultado: string | null
}

/** Filas de generación que se muestran por mensaje; los pasos auxiliares quedan en Observabilidad. */
const COMPONENTES = ['chat', 'cotizar']
const LOTE = 100

export function requestIdValido(v: unknown): v is string {
  return typeof v === 'string' && v.length >= 8 && v.length <= 80 && /^[\w-]+$/.test(v)
}

/** Suma las filas de un mismo request (cotizar puede escribir más de una generación). */
export function agruparUso(filas: FilaUso[]): Map<string, UsoVerificado> {
  const out = new Map<string, UsoVerificado>()
  for (const f of filas) {
    if (!f.request_id) continue
    const costo = f.costo_usd == null ? null : Number(f.costo_usd)
    const prev = out.get(f.request_id)
    if (!prev) {
      out.set(f.request_id, {
        prompt: f.tokens_prompt ?? 0,
        completion: f.tokens_completion ?? 0,
        thoughts: f.tokens_thoughts ?? 0,
        cached: f.tokens_cached ?? 0,
        costoUsd: costo != null && Number.isFinite(costo) ? costo : null,
        modelo: f.modelo,
        latenciaMs: f.latencia_ms,
        resultado: f.resultado,
      })
      continue
    }
    prev.prompt += f.tokens_prompt ?? 0
    prev.completion += f.tokens_completion ?? 0
    prev.thoughts += f.tokens_thoughts ?? 0
    prev.cached += f.tokens_cached ?? 0
    // Un costo desconocido vuelve desconocido el total: no se presenta una suma parcial como total.
    prev.costoUsd = prev.costoUsd == null || costo == null || !Number.isFinite(costo) ? null : prev.costoUsd + costo
    prev.latenciaMs = prev.latenciaMs == null || f.latencia_ms == null ? null : prev.latenciaMs + f.latencia_ms
    prev.modelo = f.modelo ?? prev.modelo
    prev.resultado = f.resultado ?? prev.resultado
  }
  return out
}

/**
 * Lee el uso verificado de los requests indicados. Nunca lanza: si la lectura
 * falla o no hay fila, el request queda fuera del mapa y su mensaje se trata
 * como declarado.
 */
export async function cargarUsoVerificado(requestIds: unknown[], signal?: AbortSignal): Promise<Map<string, UsoVerificado>> {
  const ids = [...new Set(requestIds.filter(requestIdValido))]
  const filas: FilaUso[] = []
  for (let i = 0; i < ids.length; i += LOTE) {
    let q = supabase
      .from('uso_ia')
      .select('request_id,modelo,tokens_prompt,tokens_completion,tokens_thoughts,tokens_cached,costo_usd,latencia_ms,resultado:detalle->>resultado')
      .in('request_id', ids.slice(i, i + LOTE))
      .in('componente', COMPONENTES)
    if (signal) q = q.abortSignal(signal)
    const { data, error } = await q
    if (error) {
      console.error('uso verificado', error.message)
      continue
    }
    filas.push(...((data ?? []) as unknown as FilaUso[]))
  }
  return agruparUso(filas)
}

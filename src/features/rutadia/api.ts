import { supabase } from '../../lib/supabase'
import type { Contrato } from '../../types'
import {
  ANALISIS_SCORE_SELECT,
  RUTA_DIA_COLS,
  sliceDesdeFilaAnalisis,
  type AnalisisScoreSlice,
} from './model'

const PAGE = 1000
const ID_CHUNK = 1000

/** Tope defensivo de memoria; alcanzarlo se informa como lectura incompleta. */
export const MAX_FILAS = 20000

export type AnalisisFilaScore = {
  contrato_id: number
  pdf_hash: string
  slice: AnalisisScoreSlice | null
}

/** `completo=false`: se alcanzó el tope y quedaron filas sin cargar. `total` es
 *  el conteo exacto del servidor en la primera página (null si no lo informó). */
export interface Lectura<T> {
  filas: T[]
  completo: boolean
  total: number | null
}

type Pagina = { data: unknown[] | null; error: unknown; count?: number | null }

/** Corta el trabajo dependiente cuando la carga ya fue cancelada o venció. */
function exigirVigente(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Carga cancelada', 'AbortError')
}

/**
 * Recorre una consulta ordenada hasta agotarla. El fin lo decide el conteo
 * exacto del servidor, no el tamaño de página: si `max_rows` de PostgREST
 * fuese menor que PAGE, una página corta no se confunde con la última.
 */
async function leerPaginado<T>(
  pagina: (desde: number, hasta: number, contar: boolean) => PromiseLike<Pagina>,
  signal?: AbortSignal,
): Promise<Lectura<T>> {
  const filas: T[] = []
  let total: number | null = null
  for (;;) {
    exigirVigente(signal)
    const primera = filas.length === 0
    const { data, error, count } = await pagina(filas.length, filas.length + PAGE - 1, primera)
    if (error) throw error
    if (primera && typeof count === 'number') total = count
    const batch = (data ?? []) as T[]
    filas.push(...batch)
    if (batch.length === 0) break
    if (total != null ? filas.length >= total : batch.length < PAGE) break
    if (filas.length >= MAX_FILAS) return { filas, completo: false, total }
  }
  return { filas, completo: true, total }
}

export async function fetchUniverso(signal?: AbortSignal): Promise<Lectura<Contrato>> {
  return leerPaginado<Contrato>((desde, hasta, contar) => {
    let q = supabase
      .from('v_contratos')
      .select(RUTA_DIA_COLS, contar ? { count: 'exact' } : undefined)
      .in('estado', ['Vigente', 'En Evaluación'])
      .or('categoria_it.not.is.null,relevancia_ia.not.is.null')
      // PostgREST: .range() sin .order() no garantiza orden entre paginas;
      // la pagina 2 puede repetir filas de la 1 y omitir otras.
      .order('id')
      .range(desde, hasta)
    if (signal) q = q.abortSignal(signal)
    return q as unknown as PromiseLike<Pagina>
  }, signal)
}

type FilaAnalisis = {
  contrato_id: number
  pdf_hash: string
  encaje?: unknown
  economia?: unknown
  condiciones?: unknown
  veredicto?: unknown
}

/**
 * Round-trip a analisis_contrato (chunked por límite URL).
 * Select JSON path: solo encaje/economia/condiciones/veredicto del payload.
 * Los trozos van en paralelo (Promise.all), no secuenciales, para no
 * sumar latencia de red en cada página de la Ruta del día. Cada trozo se
 * pagina por su clave (contrato_id, pdf_hash): un contrato puede tener una
 * fila por hash de TDR y ninguna se pierde por el límite de filas del servidor.
 */
export async function fetchAnalisisScore(ids: number[], signal?: AbortSignal): Promise<Lectura<AnalisisFilaScore>> {
  if (ids.length === 0) return { filas: [], completo: true, total: 0 }
  exigirVigente(signal)
  const chunks: number[][] = []
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    chunks.push(ids.slice(i, i + ID_CHUNK))
  }
  const lecturas = await Promise.all(
    chunks.map(chunk => leerPaginado<FilaAnalisis>((desde, hasta, contar) => {
      let q = supabase
        .from('analisis_contrato')
        .select(ANALISIS_SCORE_SELECT, contar ? { count: 'exact' } : undefined)
        .in('contrato_id', chunk)
        .order('contrato_id')
        .order('pdf_hash')
        .range(desde, hasta)
      if (signal) q = q.abortSignal(signal)
      return q as unknown as PromiseLike<Pagina>
    }, signal)),
  )
  const filas: AnalisisFilaScore[] = []
  let total: number | null = 0
  for (const lectura of lecturas) {
    total = total == null || lectura.total == null ? null : total + lectura.total
    for (const r of lectura.filas) {
      filas.push({
        contrato_id: r.contrato_id,
        pdf_hash: r.pdf_hash,
        slice: sliceDesdeFilaAnalisis(r),
      })
    }
  }
  return { filas, completo: lecturas.every(l => l.completo), total }
}

export interface EstadoPipeline {
  ultima_corrida_utc: string
  ultima_ingesta_utc: string | null
}

/** `null` = la tabla no tiene fila; un fallo de lectura se lanza, no se confunde con ausencia. */
export async function cargarEstadoPipeline(signal?: AbortSignal): Promise<EstadoPipeline | null> {
  let q = supabase
    .from('pipeline_estado')
    .select('ultima_corrida_utc, ultima_ingesta_utc')
    .limit(1)
  if (signal) q = q.abortSignal(signal)
  const { data, error } = await q.maybeSingle()
  if (error) throw error
  return (data as EstadoPipeline | null) ?? null
}

/** Conjunto vacío = el usuario no ocultó nada; un fallo de lectura se lanza. */
export async function cargarOcultos(userId: string, signal?: AbortSignal): Promise<Set<number>> {
  const { filas } = await leerPaginado<{ contrato_id: number }>((desde, hasta, contar) => {
    let q = supabase
      .from('ruta_ocultos')
      .select('contrato_id', contar ? { count: 'exact' } : undefined)
      .eq('user_id', userId)
      .order('contrato_id')
      .range(desde, hasta)
    if (signal) q = q.abortSignal(signal)
    return q as unknown as PromiseLike<Pagina>
  }, signal)
  return new Set(filas.map(r => r.contrato_id))
}

const PG_UNIQUE_VIOLATION = '23505'

/**
 * true = el contrato quedó oculto. Repetir un ocultar ya aplicado choca con la
 * clave (user_id, contrato_id) y cuenta como éxito: un reintento no duplica ni
 * revierte lo que ya está guardado.
 */
export async function ocultarContrato(userId: string, contratoId: number, signal?: AbortSignal): Promise<boolean> {
  let q = supabase.from('ruta_ocultos').insert({ user_id: userId, contrato_id: contratoId })
  if (signal) q = q.abortSignal(signal)
  const { error } = await q
  return !error || (error as { code?: string }).code === PG_UNIQUE_VIOLATION
}

export async function restaurarContrato(userId: string, contratoId: number, signal?: AbortSignal): Promise<boolean> {
  let q = supabase.from('ruta_ocultos').delete().eq('user_id', userId).eq('contrato_id', contratoId)
  if (signal) q = q.abortSignal(signal)
  const { error } = await q
  return !error
}

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

export type AnalisisFilaScore = {
  contrato_id: number
  pdf_hash: string
  slice: AnalisisScoreSlice | null
}

export async function fetchUniverso(): Promise<Contrato[]> {
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
export async function fetchAnalisisScore(ids: number[]): Promise<AnalisisFilaScore[]> {
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

export interface EstadoPipeline {
  ultima_corrida_utc: string
  ultima_ingesta_utc: string | null
}

export async function cargarEstadoPipeline(): Promise<EstadoPipeline | null> {
  const { data, error } = await supabase
    .from('pipeline_estado')
    .select('ultima_corrida_utc, ultima_ingesta_utc')
    .limit(1)
    .maybeSingle()
  if (error) return null
  return (data as EstadoPipeline | null) ?? null
}

export async function cargarOcultos(userId: string): Promise<Set<number>> {
  const { data, error } = await supabase
    .from('ruta_ocultos')
    .select('contrato_id')
    .eq('user_id', userId)
  if (error) return new Set()
  return new Set((data ?? []).map(r => (r as { contrato_id: number }).contrato_id))
}

export async function ocultarContrato(userId: string, contratoId: number): Promise<boolean> {
  const { error } = await supabase.from('ruta_ocultos').insert({ user_id: userId, contrato_id: contratoId })
  return !error
}

export async function restaurarContrato(userId: string, contratoId: number): Promise<boolean> {
  const { error } = await supabase.from('ruta_ocultos').delete().eq('user_id', userId).eq('contrato_id', contratoId)
  return !error
}

/** Acceso a red de la página de análisis: ficha y análisis persistido (Supabase) y POST /analizar. */

import { ANALISIS_PROMPT_VERSION, type AnalisisResponse } from '../../lib/analisis'
import { AI_PROXY, supabase } from '../../lib/supabase'
import { workerAuthHeaders } from '../../lib/workerAuth'
import type { Contrato } from '../../types'
import type { RespuestaAnalizar } from './model'

const FICHA_SELECT = 'id,nro_contratacion,descripcion_contrato,descripcion,entidad,estado,objeto,nom_area_usuaria,fecha_publica,fecha_fin_cotizacion,tipo_cotizacion,categoria_it,relevancia_ia,pdf_archivo_id,pdf_storage_path,pdf_hash'

/** Ficha del contrato; lanza si Supabase falla o no existe. */
export async function leerFicha(contratoId: number): Promise<Contrato> {
  const { data: row, error } = await supabase
    .from('v_contratos')
    .select(FICHA_SELECT)
    .eq('id', contratoId)
    .maybeSingle()
  if (error) throw error
  if (!row) throw new Error('Contrato no encontrado')
  return row as Contrato
}

/** Análisis ya calculado por el pipeline para este PDF y versión de prompt; null si no hay. */
export async function leerAnalisisPersistido(contratoId: number, pdfHash: string): Promise<AnalisisResponse | null> {
  const { data, error } = await supabase
    .from('analisis_contrato')
    .select('payload, creado_utc')
    .eq('contrato_id', contratoId)
    .eq('pdf_hash', pdfHash)
    .eq('prompt_version', ANALISIS_PROMPT_VERSION)
    .maybeSingle()
  if (error || !data?.payload || typeof data.payload !== 'object') return null
  const payload = data.payload as AnalisisResponse
  if (!payload.analisis) return null
  return { ...payload, analizado_utc: data.creado_utc ?? payload.analizado_utc }
}

/** POST /analizar; `payload` es null si el cuerpo no era JSON. */
export async function solicitarAnalisis(contratoId: number, signal?: AbortSignal): Promise<RespuestaAnalizar> {
  const headers = await workerAuthHeaders({ 'Content-Type': 'application/json' })
  const res = await fetch(`${AI_PROXY}/analizar`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ contrato_id: contratoId }),
    signal,
  })
  let payload: RespuestaAnalizar['payload']
  try {
    payload = await res.json() as NonNullable<RespuestaAnalizar['payload']>
  } catch {
    payload = null
  }
  return { status: res.status, ok: res.ok, payload }
}

import { supabase } from '../../lib/supabase'
import { PAGE, type EventoContrato, type ResumenData, type SeguimientoData } from './model'

export async function cargarResumen(): Promise<{ data: ResumenData | null; error: string | null }> {
  const { data, error } = await supabase.rpc('fn_proceso_evento_resumen')
  if (error) return { data: null, error: error.message }
  return { data: (data ?? null) as ResumenData | null, error: null }
}

export async function cargarTabla(filtros: {
  page: number
  estado: string
  version: string
  etapa: string
  busqueda: string
}): Promise<{ data: SeguimientoData | null; error: string | null }> {
  const { data, error } = await supabase.rpc('fn_seguimiento_contrato', {
    p_limite: PAGE,
    p_offset: filtros.page * PAGE,
    p_estado: filtros.estado || null,
    p_chunk_version: filtros.version || null,
    p_etapa: filtros.etapa || null,
    p_busqueda: filtros.busqueda || null,
  })
  if (error) return { data: null, error: error.message }
  return { data: (data ?? null) as SeguimientoData | null, error: null }
}

export async function cargarEventos(contratoId: number): Promise<{ data: EventoContrato[]; error: string | null }> {
  const { data, error } = await supabase.rpc('fn_proceso_eventos', {
    p_contrato_id: contratoId,
  })
  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as EventoContrato[], error: null }
}

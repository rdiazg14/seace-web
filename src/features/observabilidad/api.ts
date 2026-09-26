import { AI_PROXY, supabase } from '../../lib/supabase'
import { SIN_PAGE, type AdminStats, type SinIntentoData, type UsoIaStats } from './model'

export async function cargarAdminStats(token: string | undefined): Promise<{
  stats: AdminStats | null
  error: string | null
}> {
  if (!token) return { stats: null, error: 'No hay sesión.' }
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
      return { stats: null, error: msg }
    }
    if (!body.day || !body.kv) {
      return { stats: null, error: 'Respuesta incompleta del proxy.' }
    }
    return { stats: body as AdminStats, error: null }
  } catch (e) {
    return { stats: null, error: e instanceof Error ? e.message : 'No se pudo leer /admin/stats' }
  }
}

export interface CubsoVersion {
  version_catalogo: string
  items: number | null
  cargado_utc: string | null
}

export async function cargarCubso(): Promise<{ data: CubsoVersion | null; error: string | null }> {
  const { data, error } = await supabase
    .from('cubso_version')
    .select('version_catalogo, items, cargado_utc')
    .eq('id', 1)
    .maybeSingle()
  if (error) return { data: null, error: error.message }
  if (!data?.version_catalogo) return { data: null, error: null }
  return {
    data: {
      version_catalogo: data.version_catalogo,
      items: typeof data.items === 'number' ? data.items : null,
      cargado_utc: data.cargado_utc ?? null,
    },
    error: null,
  }
}

export async function cargarModelos(): Promise<string[]> {
  const { data, error } = await supabase.rpc('fn_uso_ia_modelos')
  if (error || !Array.isArray(data)) return []
  return data.map((m) => String(m)).filter(Boolean)
}

export async function cargarUsoIa(filtros: {
  desde: string
  hasta: string
  modelo: string
  componente: string
}): Promise<{ data: UsoIaStats | null; error: string | null }> {
  const { data, error } = await supabase.rpc('fn_uso_ia_stats', {
    p_desde: filtros.desde || null,
    p_hasta: filtros.hasta || null,
    p_modelo: filtros.modelo || null,
    p_componente: filtros.componente || null,
  })
  if (error) return { data: null, error: error.message }
  return { data: (data ?? null) as UsoIaStats | null, error: null }
}

export async function cargarSinIntento(
  page: number,
  soloTi: boolean,
): Promise<{ data: SinIntentoData | null; error: string | null }> {
  const { data, error } = await supabase.rpc('fn_sin_intento', {
    p_limite: SIN_PAGE,
    p_offset: page * SIN_PAGE,
    p_solo_ti: soloTi,
  })
  if (error) return { data: null, error: error.message }
  return { data: (data ?? null) as SinIntentoData | null, error: null }
}

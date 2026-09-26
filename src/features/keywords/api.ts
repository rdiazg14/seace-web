import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from '../../lib/supabase'
import type { CandidataRow, ColaRow, KeywordRow } from './model'

export interface SimularResultado {
  keyword: string
  categoria: string
  universo: number
  etiquetaria: number
  ya_etiquetados: number
  cambios_categoria: number
  ratio_predictivo: number | null
  ejemplos: { id: number; titulo: string | null }[]
}

export interface AdminKwError {
  error?: string
  mensaje?: string
  id?: number
}

async function callAdminKw<T>(
  path: string,
  method: 'POST' | 'PATCH',
  token: string,
  body?: unknown,
): Promise<{ ok: true; data: T } | { ok: false; status: number; err: AdminKwError }> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-keywords${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const err = await res.json().catch(() => ({})) as AdminKwError & T
  if (!res.ok) {
    return { ok: false, status: res.status, err }
  }
  return { ok: true, data: err as T }
}

export function crearKeyword(token: string, body: {
  keyword: string
  categoria: string
  tipo: 'incluye' | 'excluye'
  limite_palabra?: boolean
  tolera_plural?: boolean
  nota?: string
}) {
  return callAdminKw('', 'POST', token, body)
}

export function patchKeyword(token: string, id: number, body: { activa?: boolean; nota?: string }) {
  return callAdminKw(`/${id}`, 'PATCH', token, body)
}

export function simularKeyword(token: string, body: {
  keyword: string
  categoria: string
  limite_palabra?: boolean
}) {
  return callAdminKw<SimularResultado>('/simular', 'POST', token, body)
}

export function promoverCandidata(token: string, candidata_id: number) {
  return callAdminKw('/promover', 'POST', token, { candidata_id })
}

export function colaAprobar(token: string, id: number, categoria: string) {
  return callAdminKw<{ ok: boolean; contrato_id: number; categoria: string; capa: string }>(
    '/cola/aprobar',
    'POST',
    token,
    { id, categoria },
  )
}

export function colaRechazar(token: string, id: number) {
  return callAdminKw<{ ok: boolean; contrato_id: number; estado: string }>(
    '/cola/rechazar',
    'POST',
    token,
    { id },
  )
}

export interface KeywordsData {
  rows: KeywordRow[]
  cands: CandidataRow[]
  cola: ColaRow[]
}

/** Carga keywords + conteos + candidatas + cola; devuelve el primer error encontrado. */
export async function cargarKeywords(): Promise<{ data: KeywordsData | null; error: string | null }> {
  const [kwRes, cntRes, candRes, colaRes] = await Promise.all([
    supabase
      .from('it_keywords')
      .select('id, categoria, keyword, tipo, prioridad, limite_palabra, tolera_plural, activa, nota')
      .order('prioridad')
      .order('id')
      .limit(5000),
    supabase.rpc('admin_keyword_conteos'),
    supabase
      .from('keyword_candidatas')
      .select('id, senal, categoria_propuesta, veces_vista, estado, evidencia')
      .order('veces_vista', { ascending: false })
      .limit(2000),
    supabase
      .from('clasificacion_pendiente')
      .select('id, contrato_id, categoria_p1, categoria_p2, origen, votos, estado, nota, titulo')
      .in('estado', ['pendiente', 'observacion'])
      .order('estado')
      .order('contrato_id', { ascending: false })
      .limit(500),
  ])
  const primerError = kwRes.error ?? cntRes.error ?? candRes.error ?? colaRes.error
  if (primerError) return { data: null, error: primerError.message }
  const counts = new Map<number, number>()
  for (const r of (cntRes.data ?? []) as { keyword_id: number; n: number }[]) {
    counts.set(Number(r.keyword_id), Number(r.n))
  }
  return {
    data: {
      rows: (kwRes.data ?? []).map((r) => ({
        ...r,
        etiquetas: counts.get(r.id) ?? 0,
      })) as KeywordRow[],
      cands: (candRes.data ?? []) as CandidataRow[],
      cola: (colaRes.data ?? []) as ColaRow[],
    },
    error: null,
  }
}

import { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase'

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

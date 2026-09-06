/** Cabecera Authorization del Worker con el JWT de la sesión Supabase. */

import { supabase } from './supabase'

/** Headers para AI_PROXY. Lanza si no hay sesión (RequireAuth debería evitarlo). */
export async function workerAuthHeaders(
  extra: Record<string, string> = {},
): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) {
    throw new Error('sin_sesion')
  }
  return {
    ...extra,
    Authorization: `Bearer ${token}`,
  }
}

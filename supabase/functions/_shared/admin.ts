import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { json } from './cors.ts'

export type Rol = 'admin' | 'normal'

export interface PerfilAdmin {
  id: string
  email: string
  rol: Rol
}

export function serviceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) {
    throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en la función')
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** JWT del caller + fila en perfiles con rol admin. 401/403 si no. */
export async function requireAdmin(
  req: Request,
): Promise<{ admin: PerfilAdmin; service: SupabaseClient } | Response> {
  const raw = req.headers.get('Authorization') || ''
  const token = raw.replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    return json(req, { error: 'unauthorized', mensaje: 'Falta la sesión.' }, 401)
  }

  const service = serviceClient()
  const { data, error } = await service.auth.getUser(token)
  if (error || !data.user) {
    return json(req, { error: 'unauthorized', mensaje: 'Sesión inválida.' }, 401)
  }

  const { data: perfil, error: pErr } = await service
    .from('perfiles')
    .select('id, email, rol')
    .eq('id', data.user.id)
    .maybeSingle()

  if (pErr || !perfil) {
    return json(req, { error: 'no_profile', mensaje: 'Tu cuenta no tiene perfil.' }, 403)
  }
  if (perfil.rol !== 'admin') {
    return json(req, { error: 'forbidden', mensaje: 'Solo un admin puede hacer esto.' }, 403)
  }

  return { admin: perfil as PerfilAdmin, service }
}

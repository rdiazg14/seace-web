import { json, optionsResponse } from '../_shared/cors.ts'
import { requireAdmin, type Rol } from '../_shared/admin.ts'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse(req)
  if (req.method !== 'POST') {
    return json(req, { error: 'method', mensaje: 'Usa POST.' }, 405)
  }

  const gate = await requireAdmin(req)
  if (gate instanceof Response) return gate
  const { admin, service } = gate

  let body: { email?: string; password?: string; rol?: string }
  try {
    body = await req.json()
  } catch {
    return json(req, { error: 'invalid_json', mensaje: 'JSON inválido.' }, 400)
  }

  const email = (body.email || '').trim().toLowerCase()
  const password = body.password || ''
  const rol = (body.rol || '').trim() as Rol

  if (!EMAIL_RE.test(email)) {
    return json(req, { error: 'validation', mensaje: 'Email inválido.' }, 400)
  }
  if (password.length < 8) {
    return json(req, { error: 'validation', mensaje: 'La clave debe tener al menos 8 caracteres.' }, 400)
  }
  if (rol !== 'admin' && rol !== 'normal') {
    return json(req, { error: 'validation', mensaje: 'El rol debe ser admin o normal.' }, 400)
  }

  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { rol },
  })

  if (error || !data.user) {
    const msg = error?.message || 'No se pudo crear el usuario.'
    const status = /already/i.test(msg) ? 409 : 400
    return json(req, { error: 'create_failed', mensaje: msg }, status)
  }

  const { error: upErr } = await service
    .from('perfiles')
    .update({ creado_por: admin.id, email, rol })
    .eq('id', data.user.id)

  if (upErr) {
    return json(req, {
      error: 'profile_update',
      mensaje: `Usuario creado pero no se actualizó el perfil: ${upErr.message}`,
      id: data.user.id,
      email,
      rol,
    }, 500)
  }

  return json(req, { id: data.user.id, email, rol })
})

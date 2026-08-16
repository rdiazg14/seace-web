import { json, optionsResponse } from '../_shared/cors.ts'
import { requireAdmin } from '../_shared/admin.ts'

const BAN = '876000h'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse(req)
  if (req.method !== 'POST') {
    return json(req, { error: 'method', mensaje: 'Usa POST.' }, 405)
  }

  const gate = await requireAdmin(req)
  if (gate instanceof Response) return gate
  const { admin, service } = gate

  let body: { id?: string }
  try {
    body = await req.json()
  } catch {
    return json(req, { error: 'invalid_json', mensaje: 'JSON inválido.' }, 400)
  }

  const id = (body.id || '').trim()
  if (!id) {
    return json(req, { error: 'validation', mensaje: 'Falta el id del usuario.' }, 400)
  }
  if (id === admin.id) {
    return json(req, { error: 'validation', mensaje: 'No puedes desactivar tu propia cuenta.' }, 400)
  }

  const { data: target, error: tErr } = await service
    .from('perfiles')
    .select('id, email, rol')
    .eq('id', id)
    .maybeSingle()

  if (tErr || !target) {
    return json(req, { error: 'not_found', mensaje: 'No existe ese usuario.' }, 404)
  }

  const { error } = await service.auth.admin.updateUserById(id, {
    ban_duration: BAN,
  })

  if (error) {
    return json(req, { error: 'ban_failed', mensaje: error.message }, 400)
  }

  return json(req, { id, email: target.email, desactivado: true })
})

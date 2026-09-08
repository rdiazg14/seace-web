import { corsHeaders } from '../_shared/cors.ts'
import { requireAdmin } from '../_shared/admin.ts'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

const METHODS = 'POST, PATCH, OPTIONS'

const CATEGORIAS = [
  'Firma digital',
  'IA/analytics',
  'Ciberseguridad',
  'Cloud/hosting',
  'Microsoft',
  'Oracle',
  'Base de datos/ERP',
  'Licencias',
  'Desarrollo software',
  'Soporte tecnico',
  'Redes/cableado',
  'Correo electronico',
  'Telemetria/OT',
  'Hardware',
] as const

type Categoria = (typeof CATEGORIAS)[number]
type TipoKw = 'incluye' | 'excluye'

function corsJson(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req, METHODS), 'Content-Type': 'application/json' },
  })
}

function corsOptions(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req, METHODS) })
}

function normalizar(s: string): string {
  const t = (s || '').normalize('NFKD').replace(/\p{M}/gu, '')
  return t.toLowerCase().replace(/\s+/g, ' ').trim()
}

function parseRuta(req: Request): { rest: string[]; id: number | null } {
  const url = new URL(req.url)
  const parts = url.pathname.split('/').filter(Boolean)
  const i = parts.lastIndexOf('admin-keywords')
  const rest = i >= 0 ? parts.slice(i + 1) : []
  const idRaw = rest[0] && /^\d+$/.test(rest[0]) ? Number(rest[0]) : null
  return { rest, id: idRaw }
}

async function readBody(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text()
  if (!text.trim()) return {}
  const v = JSON.parse(text) as unknown
  if (!v || typeof v !== 'object' || Array.isArray(v)) {
    throw new Error('invalid_json')
  }
  return v as Record<string, unknown>
}

function str(body: Record<string, unknown>, k: string): string {
  const v = body[k]
  return typeof v === 'string' ? v : ''
}

function bool(body: Record<string, unknown>, k: string, fallback = false): boolean {
  const v = body[k]
  if (typeof v === 'boolean') return v
  return fallback
}

async function prioridadDe(
  service: SupabaseClient,
  categoria: string,
): Promise<number | null> {
  const { data, error } = await service
    .from('it_keywords')
    .select('prioridad')
    .eq('categoria', categoria)
    .limit(1)
    .maybeSingle()
  if (error || data?.prioridad == null) return null
  return Number(data.prioridad)
}

async function existente(
  service: SupabaseClient,
  categoria: string,
  keyword: string,
  tipo: TipoKw,
): Promise<number | null> {
  const { data } = await service
    .from('it_keywords')
    .select('id')
    .eq('categoria', categoria)
    .eq('keyword', keyword)
    .eq('tipo', tipo)
    .maybeSingle()
  return data?.id != null ? Number(data.id) : null
}

async function crear(
  req: Request,
  service: SupabaseClient,
  adminId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const keyword = normalizar(str(body, 'keyword'))
  const categoria = str(body, 'categoria').trim() as Categoria
  const tipo = (str(body, 'tipo').trim() || 'incluye') as TipoKw
  const nota = str(body, 'nota').trim() || null
  const limite_palabra = bool(body, 'limite_palabra')
  const tolera_plural = bool(body, 'tolera_plural')

  if (!keyword || keyword.length < 2) {
    return corsJson(req, { error: 'validation', mensaje: 'Keyword demasiado corta.' }, 400)
  }
  if (!(CATEGORIAS as readonly string[]).includes(categoria)) {
    return corsJson(req, { error: 'validation', mensaje: 'Categoría no válida.' }, 400)
  }
  if (tipo !== 'incluye' && tipo !== 'excluye') {
    return corsJson(req, { error: 'validation', mensaje: "tipo debe ser 'incluye' o 'excluye'." }, 400)
  }

  const prioridad = await prioridadDe(service, categoria)
  if (prioridad == null) {
    return corsJson(req, { error: 'validation', mensaje: 'No hay prioridad para esa categoría.' }, 400)
  }

  const dup = await existente(service, categoria, keyword, tipo)
  if (dup != null) {
    return corsJson(req, {
      error: 'conflict',
      mensaje: 'Ya existe esa keyword en la categoría.',
      id: dup,
    }, 409)
  }

  const { data, error } = await service
    .from('it_keywords')
    .insert({
      categoria,
      keyword,
      prioridad,
      tipo,
      limite_palabra,
      tolera_plural,
      activa: true,
      nota,
      actualizada_utc: new Date().toISOString(),
      actualizada_por: adminId,
    })
    .select('id, categoria, keyword, prioridad, tipo, activa')
    .single()

  if (error) {
    if (error.code === '23505') {
      const id = await existente(service, categoria, keyword, tipo)
      return corsJson(req, {
        error: 'conflict',
        mensaje: 'Ya existe esa keyword en la categoría.',
        id,
      }, 409)
    }
    return corsJson(req, { error: 'write', mensaje: error.message }, 400)
  }
  return corsJson(req, data)
}

async function patch(
  req: Request,
  service: SupabaseClient,
  adminId: string,
  id: number,
  body: Record<string, unknown>,
): Promise<Response> {
  const patch: Record<string, unknown> = {
    actualizada_utc: new Date().toISOString(),
    actualizada_por: adminId,
  }
  if ('activa' in body) {
    if (typeof body.activa !== 'boolean') {
      return corsJson(req, { error: 'validation', mensaje: 'activa debe ser boolean.' }, 400)
    }
    patch.activa = body.activa
  }
  if ('nota' in body) {
    patch.nota = typeof body.nota === 'string' ? body.nota.trim() || null : null
  }
  if (!('activa' in body) && !('nota' in body)) {
    return corsJson(req, { error: 'validation', mensaje: 'Nada que editar (activa o nota).' }, 400)
  }

  const { data, error } = await service
    .from('it_keywords')
    .update(patch)
    .eq('id', id)
    .select('id, categoria, keyword, activa, nota, actualizada_utc')
    .maybeSingle()

  if (error) return corsJson(req, { error: 'write', mensaje: error.message }, 400)
  if (!data) return corsJson(req, { error: 'not_found', mensaje: 'No existe esa keyword.' }, 404)
  return corsJson(req, data)
}

async function simular(
  req: Request,
  service: SupabaseClient,
  body: Record<string, unknown>,
): Promise<Response> {
  const keyword = normalizar(str(body, 'keyword'))
  const categoria = str(body, 'categoria').trim()
  const limite_palabra = bool(body, 'limite_palabra')
  if (!keyword || keyword.length < 2) {
    return corsJson(req, { error: 'validation', mensaje: 'Keyword demasiado corta.' }, 400)
  }
  if (!(CATEGORIAS as readonly string[]).includes(categoria)) {
    return corsJson(req, { error: 'validation', mensaje: 'Categoría no válida.' }, 400)
  }
  const { data, error } = await service.rpc('admin_simular_keyword', {
    p_keyword: keyword,
    p_categoria: categoria,
    p_limite_palabra: limite_palabra,
  })
  if (error) return corsJson(req, { error: 'simular', mensaje: error.message }, 400)
  return corsJson(req, data)
}

async function promover(
  req: Request,
  service: SupabaseClient,
  adminId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const candidataId = Number(body.candidata_id ?? body.id)
  if (!Number.isFinite(candidataId) || candidataId <= 0) {
    return corsJson(req, { error: 'validation', mensaje: 'Falta candidata_id.' }, 400)
  }

  const { data: cand, error: cErr } = await service
    .from('keyword_candidatas')
    .select('id, senal, categoria_propuesta, estado, evidencia, keyword_id')
    .eq('id', candidataId)
    .maybeSingle()

  if (cErr || !cand) {
    return corsJson(req, { error: 'not_found', mensaje: 'No existe esa candidata.' }, 404)
  }
  if (cand.keyword_id) {
    return corsJson(req, {
      error: 'conflict',
      mensaje: 'Esa candidata ya tiene keyword.',
      id: cand.keyword_id,
    }, 409)
  }

  const ev = (cand.evidencia && typeof cand.evidencia === 'object')
    ? cand.evidencia as Record<string, unknown>
    : {}
  const termino = normalizar(String(ev.termino || cand.senal || ''))
  const categoria = String(cand.categoria_propuesta || '').trim()
  if (!termino) {
    return corsJson(req, { error: 'validation', mensaje: 'La candidata no tiene término extraíble.' }, 400)
  }
  if (!(CATEGORIAS as readonly string[]).includes(categoria)) {
    return corsJson(req, { error: 'validation', mensaje: 'Categoría de la candidata no válida.' }, 400)
  }

  const prioridad = await prioridadDe(service, categoria)
  if (prioridad == null) {
    return corsJson(req, { error: 'validation', mensaje: 'No hay prioridad para esa categoría.' }, 400)
  }

  const dup = await existente(service, categoria, termino, 'incluye')
  if (dup != null) {
    await service.from('keyword_candidatas').update({
      estado: 'aprobada_admin',
      keyword_id: dup,
      activada_utc: new Date().toISOString(),
      activada_por: adminId,
    }).eq('id', candidataId)
    return corsJson(req, {
      error: 'conflict',
      mensaje: 'Ya existe esa keyword. Se marcó la candidata como promovida.',
      id: dup,
    }, 409)
  }

  const { data: kw, error: iErr } = await service
    .from('it_keywords')
    .insert({
      categoria,
      keyword: termino,
      prioridad,
      tipo: 'incluye',
      limite_palabra: false,
      tolera_plural: false,
      activa: true,
      nota: `promovida desde candidata ${candidataId}`,
      actualizada_utc: new Date().toISOString(),
      actualizada_por: adminId,
    })
    .select('id, categoria, keyword, prioridad, tipo, activa')
    .single()

  if (iErr || !kw) {
    if (iErr?.code === '23505') {
      const id = await existente(service, categoria, termino, 'incluye')
      return corsJson(req, {
        error: 'conflict',
        mensaje: 'Ya existe esa keyword en la categoría.',
        id,
      }, 409)
    }
    return corsJson(req, { error: 'write', mensaje: iErr?.message || 'No se pudo crear.' }, 400)
  }

  const { error: uErr } = await service
    .from('keyword_candidatas')
    .update({
      estado: 'aprobada_admin',
      keyword_id: kw.id,
      activada_utc: new Date().toISOString(),
      activada_por: adminId,
      evidencia: { ...ev, promovida_por: adminId },
    })
    .eq('id', candidataId)

  if (uErr) {
    return corsJson(req, {
      error: 'candidata',
      mensaje: `Keyword ${kw.id} creada pero no se actualizó la candidata: ${uErr.message}`,
      keyword: kw,
    }, 500)
  }

  return corsJson(req, { keyword: kw, candidata_id: candidataId })
}

async function colaAprobar(
  req: Request,
  service: SupabaseClient,
  adminId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const pid = Number(body.id)
  const categoria = str(body, 'categoria').trim()
  if (!Number.isFinite(pid) || pid <= 0) {
    return corsJson(req, { error: 'validation', mensaje: 'Falta el id de la cola.' }, 400)
  }
  if (!(CATEGORIAS as readonly string[]).includes(categoria)) {
    return corsJson(req, { error: 'validation', mensaje: 'Categoría no válida.' }, 400)
  }

  const { data: row, error: rErr } = await service
    .from('clasificacion_pendiente')
    .select('id, contrato_id, estado, categoria_p1, categoria_p2, votos')
    .eq('id', pid)
    .maybeSingle()
  if (rErr || !row) {
    return corsJson(req, { error: 'not_found', mensaje: 'No existe ese pendiente.' }, 404)
  }
  if (row.estado !== 'pendiente') {
    return corsJson(req, { error: 'conflict', mensaje: `Estado actual: ${row.estado}.` }, 409)
  }

  const { data: prev } = await service
    .from('clasificacion_contrato')
    .select('relevancia_ia')
    .eq('contrato_id', row.contrato_id)
    .maybeSingle()

  const { error: uErr } = await service.from('clasificacion_contrato').upsert({
    contrato_id: row.contrato_id,
    categoria_it: categoria,
    relevancia_ia: prev?.relevancia_ia ?? null,
    capa: 'humano',
    consenso_n: 0,
    revisar: false,
    artefacto: 'c3_admin',
  }, { onConflict: 'contrato_id' })
  if (uErr) {
    return corsJson(req, { error: 'write', mensaje: uErr.message }, 400)
  }

  const { error: pErr } = await service.from('clasificacion_pendiente').update({
    estado: 'aprobada',
    resuelto_utc: new Date().toISOString(),
    resuelto_por: adminId,
  }).eq('id', pid)
  if (pErr) {
    return corsJson(req, { error: 'cola', mensaje: pErr.message }, 500)
  }

  return corsJson(req, {
    ok: true,
    id: pid,
    contrato_id: row.contrato_id,
    categoria,
    capa: 'humano',
  })
}

async function colaRechazar(
  req: Request,
  service: SupabaseClient,
  adminId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const pid = Number(body.id)
  if (!Number.isFinite(pid) || pid <= 0) {
    return corsJson(req, { error: 'validation', mensaje: 'Falta el id de la cola.' }, 400)
  }

  const { data: row, error: rErr } = await service
    .from('clasificacion_pendiente')
    .select('id, contrato_id, estado')
    .eq('id', pid)
    .maybeSingle()
  if (rErr || !row) {
    return corsJson(req, { error: 'not_found', mensaje: 'No existe ese pendiente.' }, 404)
  }
  if (row.estado !== 'pendiente') {
    return corsJson(req, { error: 'conflict', mensaje: `Estado actual: ${row.estado}.` }, 409)
  }

  const { error: dErr } = await service
    .from('clasificacion_contrato')
    .delete()
    .eq('contrato_id', row.contrato_id)
  if (dErr) {
    return corsJson(req, { error: 'write', mensaje: dErr.message }, 400)
  }

  const { error: pErr } = await service.from('clasificacion_pendiente').update({
    estado: 'rechazada',
    resuelto_utc: new Date().toISOString(),
    resuelto_por: adminId,
  }).eq('id', pid)
  if (pErr) {
    return corsJson(req, { error: 'cola', mensaje: pErr.message }, 500)
  }

  return corsJson(req, { ok: true, id: pid, contrato_id: row.contrato_id, estado: 'rechazada' })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsOptions(req)

  const gate = await requireAdmin(req)
  if (gate instanceof Response) {
    // requireAdmin usa json() con POST-only CORS; re-enviar con PATCH permitido
    const body = await gate.text()
    return new Response(body, {
      status: gate.status,
      headers: { ...corsHeaders(req, METHODS), 'Content-Type': 'application/json' },
    })
  }
  const { admin, service } = gate

  const { rest, id } = parseRuta(req)
  let body: Record<string, unknown> = {}
  try {
    body = await readBody(req)
  } catch {
    return corsJson(req, { error: 'invalid_json', mensaje: 'JSON inválido.' }, 400)
  }

  const accion = str(body, 'accion').trim()
  const sub = rest[0] || accion

  try {
    if (req.method === 'POST' && (sub === 'simular' || accion === 'simular')) {
      return await simular(req, service, body)
    }
    if (req.method === 'POST' && (sub === 'promover' || accion === 'promover')) {
      return await promover(req, service, admin.id, body)
    }
    if (req.method === 'POST' && (sub === 'cola' || rest[0] === 'cola')) {
      const colaAccion = rest[1] || str(body, 'cola_accion').trim() || accion
      if (colaAccion === 'aprobar') {
        return await colaAprobar(req, service, admin.id, body)
      }
      if (colaAccion === 'rechazar') {
        return await colaRechazar(req, service, admin.id, body)
      }
      return corsJson(req, { error: 'method', mensaje: 'Usá /cola/aprobar o /cola/rechazar.' }, 405)
    }
    if (req.method === 'PATCH') {
      const pid = id ?? Number(body.id)
      if (!Number.isFinite(pid) || pid <= 0) {
        return corsJson(req, { error: 'validation', mensaje: 'Falta el id.' }, 400)
      }
      return await patch(req, service, admin.id, pid, body)
    }
    if (req.method === 'POST' && (rest.length === 0 || accion === 'crear' || sub === '')) {
      return await crear(req, service, admin.id, body)
    }
    return corsJson(req, { error: 'method', mensaje: 'Ruta o método no soportado. No se borra.' }, 405)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    return corsJson(req, { error: 'server', mensaje: msg }, 500)
  }
})

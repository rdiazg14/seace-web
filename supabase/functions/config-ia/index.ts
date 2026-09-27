/**
 * config-ia (IA-002): administración de la configuración multi-modelo ia_*.
 *
 * Solo admins autenticados (requireAdmin: JWT válido + perfiles.rol='admin').
 * Ninguna respuesta devuelve claves ni clave_cifrada; las claves entran por
 * POST /proveedores/:id/clave, se cifran con IA_MASTER_KEY (AES-256-GCM) y se
 * muestran solo como máscara. Toda escritura queda en ia_config_cambios y el
 * trigger ia_bump_version invalida la caché de los consumidores.
 *
 * Rutas (tras /config-ia):
 *   GET    /                     snapshot: proveedores(saneados)+modelos+endpoints+meta
 *   GET    /auditoria            últimos 100 cambios (sin material de clave)
 *   POST   /proveedores          crear (sin clave)
 *   PATCH  /proveedores/:id      nombre/base_url/activo/notas
 *   POST   /proveedores/:id/clave  {clave:string} cifra y guarda; {clave:null} borra
 *   POST   /modelos              crear
 *   PATCH  /modelos/:id          edición administrable
 *   DELETE /modelos/:id          solo si ningún endpoint lo referencia
 *   PATCH  /endpoints/:endpoint  modelo_id/habilitados/hereda/config/activo
 */
import { corsHeaders } from '../_shared/cors.ts'
import { requireAdmin } from '../_shared/admin.ts'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import {
  cifrarClave,
  enmascararClave,
  patchEndpoint,
  patchModelo,
  patchProveedor,
  sanearParaAuditoria,
  sanearProveedor,
  validarClaveEntrada,
  validarModelo,
  validarProveedor,
} from './nucleo.ts'

const METHODS = 'GET, POST, PATCH, DELETE, OPTIONS'

function corsJson(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req, METHODS), 'Content-Type': 'application/json' },
  })
}

function parseRuta(req: Request): string[] {
  const parts = new URL(req.url).pathname.split('/').filter(Boolean)
  const i = parts.lastIndexOf('config-ia')
  return i >= 0 ? parts.slice(i + 1) : []
}

async function readBody(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text()
  if (!text.trim()) return {}
  const v = JSON.parse(text) as unknown
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('invalid_json')
  return v as Record<string, unknown>
}

async function versionConfig(service: SupabaseClient): Promise<number | null> {
  const { data } = await service
    .from('ia_meta')
    .select('valor')
    .eq('clave', 'version_config')
    .maybeSingle()
  const v = data?.valor
  return typeof v === 'number' ? v : null
}

async function auditar(
  service: SupabaseClient,
  adminId: string,
  accion: string,
  entidad: string,
  antes: unknown,
  despues: unknown,
): Promise<void> {
  const { error } = await service.from('ia_config_cambios').insert({
    user_id: adminId,
    accion,
    entidad,
    antes: sanearParaAuditoria(antes),
    despues: sanearParaAuditoria(despues),
  })
  if (error) console.error(JSON.stringify({ config_ia: 'auditoria_error', detalle: error.message }))
}

// ---------------------------------------------------------------------------
// GETs
// ---------------------------------------------------------------------------

async function snapshot(req: Request, service: SupabaseClient): Promise<Response> {
  const [prov, mod, ep, meta] = await Promise.all([
    service.from('ia_proveedores').select('*').order('id'),
    service.from('ia_modelos').select('*').order('proveedor_id').order('modelo'),
    service.from('ia_endpoints').select('*').order('endpoint'),
    service.from('ia_meta').select('clave, valor, updated_at'),
  ])
  const err = prov.error ?? mod.error ?? ep.error ?? meta.error
  if (err) return corsJson(req, { error: 'read', mensaje: err.message }, 500)
  return corsJson(req, {
    proveedores: (prov.data ?? []).map((r) => sanearProveedor(r)),
    modelos: mod.data ?? [],
    endpoints: ep.data ?? [],
    meta: meta.data ?? [],
  })
}

async function auditoria(req: Request, service: SupabaseClient): Promise<Response> {
  const { data, error } = await service
    .from('ia_config_cambios')
    .select('id, user_id, accion, entidad, antes, despues, created_at')
    .order('id', { ascending: false })
    .limit(100)
  if (error) return corsJson(req, { error: 'read', mensaje: error.message }, 500)
  return corsJson(req, { cambios: data ?? [] })
}

// ---------------------------------------------------------------------------
// Proveedores
// ---------------------------------------------------------------------------

async function crearProveedor(
  req: Request,
  service: SupabaseClient,
  adminId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const v = validarProveedor(body)
  if (!v.ok) return corsJson(req, { error: 'validation', mensaje: v.mensaje }, 400)
  const datos = { ...v.datos, creado_por: adminId }

  const { data, error } = await service
    .from('ia_proveedores')
    .insert(datos)
    .select('id, nombre, tipo_api, base_url, activo, notas')
    .single()
  if (error) {
    if (error.code === '23505') {
      return corsJson(req, { error: 'conflict', mensaje: 'Ya existe ese proveedor.' }, 409)
    }
    return corsJson(req, { error: 'write', mensaje: error.message }, 400)
  }
  await auditar(service, adminId, 'crear_proveedor', `ia_proveedores:${data.id}`, null, data)
  return corsJson(req, { proveedor: data, version_config: await versionConfig(service) })
}

async function editarProveedor(
  req: Request,
  service: SupabaseClient,
  adminId: string,
  id: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const v = patchProveedor(body)
  if (!v.ok) return corsJson(req, { error: 'validation', mensaje: v.mensaje }, 400)

  const { data: antes } = await service
    .from('ia_proveedores')
    .select('id, nombre, tipo_api, base_url, activo, notas, clave_mascara')
    .eq('id', id)
    .maybeSingle()
  if (!antes) return corsJson(req, { error: 'not_found', mensaje: 'No existe ese proveedor.' }, 404)

  const { data, error } = await service
    .from('ia_proveedores')
    .update(v.datos)
    .eq('id', id)
    .select('id, nombre, tipo_api, base_url, activo, notas, clave_mascara')
    .single()
  if (error) return corsJson(req, { error: 'write', mensaje: error.message }, 400)

  const accion = 'activo' in v.datos ? (v.datos.activo ? 'activar' : 'desactivar') : 'editar_proveedor'
  await auditar(service, adminId, accion, `ia_proveedores:${id}`, antes, data)
  return corsJson(req, { proveedor: data, version_config: await versionConfig(service) })
}

async function escribirClave(
  req: Request,
  service: SupabaseClient,
  adminId: string,
  id: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const v = validarClaveEntrada(body)
  if (!v.ok) return corsJson(req, { error: 'validation', mensaje: v.mensaje }, 400)

  const { data: prov } = await service
    .from('ia_proveedores')
    .select('id, tipo_api, clave_cifrada, clave_mascara')
    .eq('id', id)
    .maybeSingle()
  if (!prov) return corsJson(req, { error: 'not_found', mensaje: 'No existe ese proveedor.' }, 404)
  if (prov.tipo_api === 'nativo') {
    return corsJson(req, { error: 'validation', mensaje: 'Un proveedor nativo no usa clave.' }, 400)
  }

  const clave = v.datos.clave as string | null
  const patch: Record<string, unknown> = { clave_cifrada: null, clave_mascara: null }
  let mascara: string | null = null

  if (clave !== null) {
    const master = Deno.env.get('IA_MASTER_KEY')
    if (!master) {
      return corsJson(req, { error: 'config', mensaje: 'IA_MASTER_KEY no configurada en la función.' }, 500)
    }
    try {
      patch.clave_cifrada = await cifrarClave(clave, master)
    } catch (e) {
      return corsJson(req, {
        error: 'config',
        mensaje: e instanceof Error ? e.message : 'No se pudo cifrar.',
      }, 500)
    }
    mascara = enmascararClave(clave)
    patch.clave_mascara = mascara
  }

  const { error } = await service.from('ia_proveedores').update(patch).eq('id', id)
  if (error) return corsJson(req, { error: 'write', mensaje: error.message }, 400)

  const accion = clave === null
    ? 'clave'
    : (prov.clave_cifrada ? 'rotar_clave' : 'clave')
  await auditar(service, adminId, accion, `ia_proveedores:${id}`, {
    tiene_clave: prov.clave_cifrada != null,
    clave_mascara: prov.clave_mascara,
  }, {
    tiene_clave: clave !== null,
    clave_mascara: mascara,
  })
  return corsJson(req, {
    ok: true,
    proveedor: id,
    tiene_clave: clave !== null,
    clave_mascara: mascara,
    version_config: await versionConfig(service),
  })
}

// ---------------------------------------------------------------------------
// Modelos
// ---------------------------------------------------------------------------

async function crearModelo(
  req: Request,
  service: SupabaseClient,
  adminId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const v = validarModelo(body)
  if (!v.ok) return corsJson(req, { error: 'validation', mensaje: v.mensaje }, 400)

  const { data: prov } = await service
    .from('ia_proveedores')
    .select('id')
    .eq('id', v.datos.proveedor_id as string)
    .maybeSingle()
  if (!prov) return corsJson(req, { error: 'validation', mensaje: 'proveedor_id no existe.' }, 400)

  const { data, error } = await service
    .from('ia_modelos')
    .insert(v.datos)
    .select('id, proveedor_id, modelo, tipo, activo')
    .single()
  if (error) {
    if (error.code === '23505') {
      return corsJson(req, { error: 'conflict', mensaje: 'Ya existe ese modelo en el proveedor.' }, 409)
    }
    return corsJson(req, { error: 'write', mensaje: error.message }, 400)
  }
  await auditar(service, adminId, 'crear_modelo', `ia_modelos:${data.id}`, null, data)
  return corsJson(req, { modelo: data, version_config: await versionConfig(service) })
}

async function editarModelo(
  req: Request,
  service: SupabaseClient,
  adminId: string,
  id: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const v = patchModelo(body)
  if (!v.ok) return corsJson(req, { error: 'validation', mensaje: v.mensaje }, 400)

  const { data: antes } = await service
    .from('ia_modelos')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (!antes) return corsJson(req, { error: 'not_found', mensaje: 'No existe ese modelo.' }, 404)

  const { data, error } = await service
    .from('ia_modelos')
    .update(v.datos)
    .eq('id', id)
    .select()
    .single()
  if (error) return corsJson(req, { error: 'write', mensaje: error.message }, 400)

  const accion = 'activo' in v.datos ? (v.datos.activo ? 'activar' : 'desactivar') : 'editar_modelo'
  await auditar(service, adminId, accion, `ia_modelos:${id}`, antes, data)
  return corsJson(req, { modelo: data, version_config: await versionConfig(service) })
}

async function borrarModelo(
  req: Request,
  service: SupabaseClient,
  adminId: string,
  id: string,
): Promise<Response> {
  const { data: antes } = await service
    .from('ia_modelos')
    .select('id, proveedor_id, modelo, tipo')
    .eq('id', id)
    .maybeSingle()
  if (!antes) return corsJson(req, { error: 'not_found', mensaje: 'No existe ese modelo.' }, 404)

  // Referencia directa o dentro de habilitados[]: borrarlo dejaría uids sueltos
  // que el trigger ia_endpoints_validar rechazaría en el próximo update.
  const { data: refs } = await service
    .from('ia_endpoints')
    .select('endpoint, modelo_id, habilitados')
  const usado = (refs ?? []).filter((e) =>
    e.modelo_id === id || (Array.isArray(e.habilitados) && e.habilitados.includes(id))
  )
  if (usado.length > 0) {
    return corsJson(req, {
      error: 'conflict',
      mensaje: `El modelo está referenciado por: ${usado.map((e) => e.endpoint).join(', ')}.`,
      endpoints: usado.map((e) => e.endpoint),
    }, 409)
  }

  const { error } = await service.from('ia_modelos').delete().eq('id', id)
  if (error) return corsJson(req, { error: 'write', mensaje: error.message }, 400)
  await auditar(service, adminId, 'borrar_modelo', `ia_modelos:${id}`, antes, null)
  return corsJson(req, { ok: true, version_config: await versionConfig(service) })
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

async function editarEndpoint(
  req: Request,
  service: SupabaseClient,
  adminId: string,
  endpoint: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const v = patchEndpoint(endpoint, body)
  if (!v.ok) return corsJson(req, { error: 'validation', mensaje: v.mensaje }, 400)

  const { data: antes } = await service
    .from('ia_endpoints')
    .select('*')
    .eq('endpoint', endpoint)
    .maybeSingle()
  if (!antes) return corsJson(req, { error: 'not_found', mensaje: 'No existe ese endpoint.' }, 404)

  const { data, error } = await service
    .from('ia_endpoints')
    .update(v.datos)
    .eq('endpoint', endpoint)
    .select()
    .single()
  if (error) {
    // El trigger ia_endpoints_validar explica tipo/espacio en su mensaje.
    return corsJson(req, { error: 'validation', mensaje: error.message }, 400)
  }

  const accion = 'activo' in v.datos && v.datos.activo !== antes.activo
    ? (v.datos.activo ? 'activar' : 'desactivar')
    : 'asignar_endpoint'
  await auditar(service, adminId, accion, `ia_endpoints:${endpoint}`, antes, data)
  return corsJson(req, { endpoint: data, version_config: await versionConfig(service) })
}

// ---------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req, METHODS) })
  }

  const gate = await requireAdmin(req)
  if (gate instanceof Response) {
    const body = await gate.text()
    return new Response(body, {
      status: gate.status,
      headers: { ...corsHeaders(req, METHODS), 'Content-Type': 'application/json' },
    })
  }
  const { admin, service } = gate

  const rest = parseRuta(req)
  let body: Record<string, unknown> = {}
  try {
    body = await readBody(req)
  } catch {
    return corsJson(req, { error: 'invalid_json', mensaje: 'JSON inválido.' }, 400)
  }

  try {
    if (req.method === 'GET' && rest.length === 0) return await snapshot(req, service)
    if (req.method === 'GET' && rest[0] === 'auditoria') return await auditoria(req, service)

    if (rest[0] === 'proveedores') {
      if (req.method === 'POST' && rest.length === 1) {
        return await crearProveedor(req, service, admin.id, body)
      }
      const id = rest[1]
      if (id && rest.length === 2 && req.method === 'PATCH') {
        return await editarProveedor(req, service, admin.id, id, body)
      }
      if (id && rest[2] === 'clave' && req.method === 'POST') {
        return await escribirClave(req, service, admin.id, id, body)
      }
    }

    if (rest[0] === 'modelos') {
      if (req.method === 'POST' && rest.length === 1) {
        return await crearModelo(req, service, admin.id, body)
      }
      const id = rest[1]
      if (id && rest.length === 2) {
        if (req.method === 'PATCH') return await editarModelo(req, service, admin.id, id, body)
        if (req.method === 'DELETE') return await borrarModelo(req, service, admin.id, id)
      }
    }

    if (rest[0] === 'endpoints' && rest[1] && rest.length === 2 && req.method === 'PATCH') {
      return await editarEndpoint(req, service, admin.id, rest[1], body)
    }

    return corsJson(req, { error: 'method', mensaje: 'Ruta o método no soportado.' }, 405)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    return corsJson(req, { error: 'server', mensaje: msg }, 500)
  }
})

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import {
  cifrarClave, enmascararClave, patchEndpoint, patchMeta, patchModelo, patchProveedor,
  sanearParaAuditoria, sanearProveedor, validarClaveEntrada, validarModelo,
  validarProveedor, type Validacion,
} from './nucleo.ts'

type Gate = { admin: { id: string }; service: SupabaseClient } | Response
interface Dependencias {
  requireAdmin: (req: Request) => Promise<Gate>
  masterKey: () => string | undefined
}
const METHODS = 'GET, POST, PATCH, DELETE, OPTIONS'
const MAX_BODY = 65536

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req, METHODS), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

async function bodyLimitado(req: Request): Promise<Record<string, unknown>> {
  if (Number(req.headers.get('content-length')) > MAX_BODY) throw new RangeError()
  if (!req.body) return {}
  const reader = req.body.getReader()
  const parts: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_BODY) { await reader.cancel(); throw new RangeError() }
      parts.push(value)
    }
  } finally { reader.releaseLock() }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength }
  const text = new TextDecoder().decode(bytes)
  const body: unknown = text.trim() ? JSON.parse(text) : {}
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new SyntaxError()
  return body as Record<string, unknown>
}

export function crearHandler(deps: Dependencias) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(req, METHODS) })
    }
    try {
      const gate = await deps.requireAdmin(req)
      if (gate instanceof Response) {
        return new Response(await gate.text(), { status: gate.status,
          headers: { ...corsHeaders(req, METHODS), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
      }
      const { admin, service } = gate
      const parts = new URL(req.url).pathname.split('/').filter(Boolean)
      const pos = parts.indexOf('config-ia')
      if (pos < 0) return json(req, { error: 'method' }, 405)
      const route = parts.slice(pos + 1)
      if (req.method === 'GET' && route.length === 0) {
        const [prov, mod, ep, meta, saldo] = await Promise.all([
          service.from('ia_proveedores').select('id,nombre,tipo_api,base_url,activo,notas,clave_mascara,saldo_inicial_usd,saldo_fecha,created_at,updated_at'),
          service.from('ia_modelos').select('*'), service.from('ia_endpoints').select('*'),
          service.from('ia_meta').select('clave,valor,updated_at'),
          service.rpc('fn_ia_saldo'),
        ])
        if (prov.error || mod.error || ep.error || meta.error) return json(req, { error: 'read' }, 500)
        // Saldo estimado = inicial − consumo observado en uso_ia (no es el
        // saldo real del proveedor: solo lo que pasó por nuestra telemetría).
        const saldos = new Map<string, Record<string, unknown>>()
        if (!saldo.error && Array.isArray(saldo.data)) {
          for (const s of saldo.data as Record<string, unknown>[]) {
            saldos.set(String(s.proveedor), s)
          }
        }
        return json(req, {
          proveedores: (prov.data ?? []).map(r => sanearProveedor({
            ...r, tiene_clave: r.clave_mascara != null,
            consumo_usd: saldos.get(String(r.id))?.consumo_usd ?? null,
            saldo_estimado_usd: saldos.get(String(r.id))?.saldo_estimado_usd ?? null,
          })),
          modelos: sanearParaAuditoria(mod.data ?? []), endpoints: sanearParaAuditoria(ep.data ?? []), meta: meta.data ?? [],
        })
      }
      if (req.method === 'GET' && route.length === 1 && route[0] === 'auditoria') {
        const { data, error } = await service.from('ia_config_cambios')
          .select('id,user_id,accion,entidad,antes,despues,origen,created_at').order('id', { ascending: false }).limit(100)
        return error ? json(req, { error: 'read' }, 500) : json(req, { cambios: sanearParaAuditoria(data ?? []) })
      }
      if (req.method === 'GET' && route.length === 1 && route[0] === 'failover') {
        const { data, error } = await service.from('ia_failover_eventos')
          .select('id,endpoint,de_proveedor,de_modelo,a_proveedor,a_modelo,error_kind,status,modo,posicion,ok,dur_ms,request_id,version_config,created_at')
          .order('id', { ascending: false }).limit(50)
        return error ? json(req, { error: 'read' }, 500) : json(req, { eventos: data ?? [] })
      }
      let body: Record<string, unknown>
      try { body = await bodyLimitado(req) }
      catch (e) { return json(req, { error: e instanceof RangeError ? 'body_too_large' : 'invalid_json' }, e instanceof RangeError ? 413 : 400) }
      const [resource, id] = route
      let table: string
      let operation: string
      let valid: Validacion
      const keyRoute = resource === 'proveedores' && route.length === 3 && route[2] === 'clave' && req.method === 'POST'
      if (keyRoute) {
        table = 'ia_proveedores'; operation = 'clave'; valid = validarClaveEntrada(body)
        if (valid.ok) {
          const key = valid.datos.clave as string | null
          if (key === null) valid = { ok: true, datos: { clave_cifrada: null, clave_mascara: null } }
          else {
            const master = deps.masterKey()
            if (!master) return json(req, { error: 'config' }, 500)
            try { valid = { ok: true, datos: { clave_cifrada: await cifrarClave(key, master), clave_mascara: enmascararClave(key) } } }
            catch { return json(req, { error: 'config' }, 500) }
          }
        }
      } else if (resource === 'proveedores' && route.length === 1 && req.method === 'POST') {
        table = 'ia_proveedores'; operation = 'crear'; valid = validarProveedor(body)
      } else if (resource === 'proveedores' && route.length === 2 && req.method === 'PATCH') {
        table = 'ia_proveedores'; operation = 'editar'; valid = patchProveedor(body)
      } else if (resource === 'modelos' && route.length === 1 && req.method === 'POST') {
        table = 'ia_modelos'; operation = 'crear'; valid = validarModelo(body)
      } else if (resource === 'modelos' && route.length === 2 && req.method === 'PATCH') {
        table = 'ia_modelos'; operation = 'editar'; valid = patchModelo(body)
      } else if (resource === 'modelos' && route.length === 2 && req.method === 'DELETE') {
        table = 'ia_modelos'; operation = 'borrar'; valid = { ok: true, datos: {} }
      } else if (resource === 'endpoints' && route.length === 2 && req.method === 'PATCH') {
        table = 'ia_endpoints'; operation = 'editar'; valid = patchEndpoint(id, body)
      } else if (resource === 'meta' && route.length === 2 && req.method === 'PATCH') {
        table = 'ia_meta'; operation = 'editar'; valid = patchMeta(id, body)
      } else return json(req, { error: 'method' }, 405)
      if (!valid.ok) return json(req, { error: 'validation', mensaje: valid.mensaje }, 400)
      const { data, error } = await service.rpc('ia_config_mutar', {
        p_tabla: table, p_id: id ?? null, p_operacion: operation, p_datos: valid.datos, p_actor: admin.id,
      })
      if (error) {
        const status = error.code === 'P0002' ? 404 : ['23505','23503'].includes(error.code) ? 409
          : error.code === '42501' ? 403 : ['22023','23514','23502','22P02','P0001'].includes(error.code) ? 400 : 500
        return json(req, { error: status === 500 ? 'write' : 'validation' }, status)
      }
      if (!data || typeof data.version_config !== 'number') return json(req, { error: 'write' }, 500)
      if (keyRoute) return json(req, { ok: true, proveedor: id, tiene_clave: data.registro.tiene_clave,
        clave_mascara: data.registro.clave_mascara, version_config: data.version_config })
      if (operation === 'borrar') return json(req, { ok: true, version_config: data.version_config })
      const field = resource === 'proveedores' ? 'proveedor' : resource === 'modelos' ? 'modelo'
        : resource === 'meta' ? 'meta' : 'endpoint'
      return json(req, { [field]: sanearParaAuditoria(data.registro), version_config: data.version_config })
    } catch { return json(req, { error: 'server' }, 500) }
  }
}

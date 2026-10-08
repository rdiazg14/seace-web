/**
 * Núcleo puro de la Edge Function config-ia (IA-002).
 *
 * Sin imports Deno/npm: todo lo testeable vive aquí (WebCrypto + validación).
 * index.ts solo adapta HTTP/Supabase a estas funciones.
 *
 * Cifrado: AES-256-GCM `v1.<b64(iv12)>.<b64(ct||tag)>` — contrato IA-001,
 * idéntico a seace-ai-proxy/src/ia/crypto.ts y seace_monitor/ia/crypto.py.
 */

export const ENDPOINTS = [
  'chat',
  'cotizar',
  'analizar',
  'clasificar',
  'query_rewrite',
  'embeddings',
  'ocr',
  'reranker',
] as const

export const TIPOS_API = ['openai', 'gemini', 'nativo'] as const
export const TIPOS_MODELO = ['generacion', 'embedding', 'ocr', 'reranker'] as const

export type Endpoint = (typeof ENDPOINTS)[number]

export type Validacion =
  | { ok: true; datos: Record<string, unknown> }
  | { ok: false; mensaje: string }

const VERSION = 'v1'
const IV_BYTES = 12
const KEY_BYTES = 32

function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64.trim())
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

async function importMasterKey(masterB64: string): Promise<CryptoKey> {
  const raw = fromB64(masterB64)
  if (raw.length !== KEY_BYTES) throw new Error('IA_MASTER_KEY debe ser base64 de 32 bytes')
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

/** Cifra una clave de proveedor para ia_proveedores.clave_cifrada. */
export async function cifrarClave(clave: string, masterB64: string): Promise<string> {
  if (!clave) throw new Error('clave vacía')
  const key = await importMasterKey(masterB64)
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(clave),
  )
  return `${VERSION}.${toB64(iv)}.${toB64(ct)}`
}

/** Solo para verificación interna/tests; la EF jamás devuelve el plano. */
export async function descifrarClave(blob: string, masterB64: string): Promise<string> {
  const key = await importMasterKey(masterB64)
  const parts = blob.split('.')
  if (parts.length !== 3) throw new Error('formato de clave_cifrada inválido')
  const [version, ivB64, ctB64] = parts
  if (version !== VERSION) throw new Error(`versión de cifrado no soportada: ${version}`)
  const iv = fromB64(ivB64)
  const ct = fromB64(ctB64)
  if (iv.length !== IV_BYTES || ct.length < 17) throw new Error('blob de clave_cifrada corrupto')
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
  return new TextDecoder().decode(plain)
}

/** 'sk-...wxyz': jamás el valor completo ni el cifrado. */
export function enmascararClave(clave: string): string {
  if (clave.length <= 7) return '...'
  return `${clave.slice(0, 3)}...${clave.slice(-4)}`
}

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function texto(body: Record<string, unknown>, k: string): string {
  const v = body[k]
  return typeof v === 'string' ? v.trim() : ''
}

function esUrlHttps(v: string): boolean {
  try {
    const url = new URL(v)
    return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash
  } catch {
    return false
  }
}

function esUuid(v: unknown): boolean {
  return typeof v === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
}

// ---------------------------------------------------------------------------
// Proveedores
// ---------------------------------------------------------------------------

/** Crear proveedor: campos mínimos, sin clave (va por /clave). */
export function validarProveedor(body: Record<string, unknown>): Validacion {
  const id = texto(body, 'id')
  const nombre = texto(body, 'nombre')
  const tipoApi = texto(body, 'tipo_api')
  const baseUrl = texto(body, 'base_url')

  if (!/^[a-z][a-z0-9_-]{1,31}$/.test(id)) {
    return { ok: false, mensaje: 'id inválido (minúsculas, 2-32, letra inicial).' }
  }
  if (!nombre) return { ok: false, mensaje: 'nombre requerido.' }
  if (!(TIPOS_API as readonly string[]).includes(tipoApi)) {
    return { ok: false, mensaje: `tipo_api debe ser ${TIPOS_API.join('|')}.` }
  }
  if (tipoApi !== 'nativo' && !esUrlHttps(baseUrl)) {
    return { ok: false, mensaje: 'base_url https requerida (salvo tipo_api nativo).' }
  }
  if ('clave' in body || 'clave_cifrada' in body) {
    return { ok: false, mensaje: 'La clave se escribe solo vía POST /proveedores/:id/clave.' }
  }

  return {
    ok: true,
    datos: {
      id,
      nombre,
      tipo_api: tipoApi,
      base_url: tipoApi === 'nativo' ? null : baseUrl,
      notas: texto(body, 'notas') || null,
    },
  }
}

/** Edición de proveedor: solo campos administrables, nunca la clave. */
export function patchProveedor(body: Record<string, unknown>): Validacion {
  const patch: Record<string, unknown> = {}
  if ('nombre' in body) {
    const v = texto(body, 'nombre')
    if (!v) return { ok: false, mensaje: 'nombre vacío.' }
    patch.nombre = v
  }
  if ('base_url' in body) {
    const v = texto(body, 'base_url')
    if (!v || !esUrlHttps(v)) return { ok: false, mensaje: 'base_url debe ser https.' }
    patch.base_url = v || null
  }
  if ('activo' in body) {
    if (typeof body.activo !== 'boolean') {
      return { ok: false, mensaje: 'activo debe ser boolean.' }
    }
    patch.activo = body.activo
  }
  if ('notas' in body) patch.notas = texto(body, 'notas') || null
  // GW-008: saldo inicial declarado por el admin (referencia del estimado).
  if ('saldo_inicial_usd' in body) {
    const v = body.saldo_inicial_usd
    if (v === null) {
      patch.saldo_inicial_usd = null
      patch.saldo_fecha = null
    } else if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 1e9) {
      patch.saldo_inicial_usd = v
      patch.saldo_fecha = new Date().toISOString()
    } else {
      return { ok: false, mensaje: 'saldo_inicial_usd debe ser número ≥ 0 o null.' }
    }
  }
  if ('clave' in body || 'clave_cifrada' in body) {
    return { ok: false, mensaje: 'La clave se escribe solo vía POST /proveedores/:id/clave.' }
  }
  if (Object.keys(patch).length === 0) {
    return { ok: false, mensaje: 'Nada que editar (nombre, base_url, activo, notas, saldo_inicial_usd).' }
  }
  return { ok: true, datos: patch }
}

/** GW-008: mutación de ia_meta — solo claves operativas explícitas. */
const META_EDITABLES: Record<string, readonly string[]> = {
  modo_failover: ['auto', 'manual'],
}

export function patchMeta(clave: string, body: Record<string, unknown>): Validacion {
  const permitidos = META_EDITABLES[clave]
  if (!permitidos) return { ok: false, mensaje: `meta '${clave}' no es editable por esta vía.` }
  const v = body.valor
  if (typeof v !== 'string' || !(permitidos as readonly string[]).includes(v)) {
    return { ok: false, mensaje: `valor debe ser ${permitidos.join('|')}.` }
  }
  return { ok: true, datos: { valor: v } }
}

/** Valida la clave entrante antes de cifrarla. null = borrado explícito. */
export function validarClaveEntrada(body: Record<string, unknown>): Validacion {
  if (!('clave' in body)) return { ok: false, mensaje: 'Falta clave (o null para borrar).' }
  if (body.clave === null) return { ok: true, datos: { clave: null } }
  const v = body.clave
  if (typeof v !== 'string' || v.trim().length < 8) {
    return { ok: false, mensaje: 'clave debe ser texto de al menos 8 caracteres.' }
  }
  return { ok: true, datos: { clave: v.trim() } }
}

// ---------------------------------------------------------------------------
// Modelos
// ---------------------------------------------------------------------------

export function validarModelo(body: Record<string, unknown>): Validacion {
  const proveedorId = texto(body, 'proveedor_id')
  const modelo = texto(body, 'modelo')
  const tipo = texto(body, 'tipo')

  if (!proveedorId) return { ok: false, mensaje: 'proveedor_id requerido.' }
  if (!modelo || modelo.length > 120 || /\s/.test(modelo)) {
    return { ok: false, mensaje: 'modelo requerido (sin espacios, ≤120).' }
  }
  if (!(TIPOS_MODELO as readonly string[]).includes(tipo)) {
    return { ok: false, mensaje: `tipo debe ser ${TIPOS_MODELO.join('|')}.` }
  }

  const datos: Record<string, unknown> = {
    proveedor_id: proveedorId,
    modelo,
    tipo,
  }

  const dimensiones = body.dimensiones
  const espacio = texto(body, 'espacio_vectorial')
  if (tipo === 'embedding') {
    if (!Number.isInteger(dimensiones) || (dimensiones as number) <= 0) {
      return { ok: false, mensaje: 'embedding requiere dimensiones (entero > 0).' }
    }
    if (!espacio) {
      return { ok: false, mensaje: 'embedding requiere espacio_vectorial.' }
    }
  }
  if (dimensiones !== undefined && dimensiones !== null) {
    if (!Number.isInteger(dimensiones) || (dimensiones as number) <= 0) {
      return { ok: false, mensaje: 'dimensiones debe ser entero > 0.' }
    }
    datos.dimensiones = dimensiones
  }
  if (espacio) datos.espacio_vectorial = espacio

  for (const k of ['contexto_max', 'salida_max', 'timeout_ms'] as const) {
    const v = body[k]
    if (v === undefined || v === null) continue
    if (!Number.isInteger(v) || (v as number) <= 0) {
      return { ok: false, mensaje: `${k} debe ser entero > 0.` }
    }
    datos[k] = v
  }

  for (const k of ['capacidades', 'params', 'precio'] as const) {
    const v = body[k]
    if (v === undefined) continue
    if (!esObjeto(v) || contieneSecreto(v)) return { ok: false, mensaje: `${k} debe ser objeto JSON sin credenciales.` }
    datos[k] = v
  }

  if ('activo' in body) {
    if (typeof body.activo !== 'boolean') {
      return { ok: false, mensaje: 'activo debe ser boolean.' }
    }
    datos.activo = body.activo
  }
  const notas = texto(body, 'notas')
  if (notas) datos.notas = notas
  return { ok: true, datos }
}

/** Edición de modelo: mismos campos, todos opcionales. */
export function patchModelo(body: Record<string, unknown>): Validacion {
  const patch: Record<string, unknown> = {}

  if ('modelo' in body) {
    const v = texto(body, 'modelo')
    if (!v || v.length > 120 || /\s/.test(v)) {
      return { ok: false, mensaje: 'modelo inválido (sin espacios, ≤120).' }
    }
    patch.modelo = v
  }
  if ('tipo' in body) {
    const v = texto(body, 'tipo')
    if (!(TIPOS_MODELO as readonly string[]).includes(v)) {
      return { ok: false, mensaje: `tipo debe ser ${TIPOS_MODELO.join('|')}.` }
    }
    patch.tipo = v
  }
  for (const k of ['contexto_max', 'salida_max', 'timeout_ms', 'dimensiones'] as const) {
    if (!(k in body)) continue
    const v = body[k]
    if (v === null) {
      patch[k] = null
      continue
    }
    if (!Number.isInteger(v) || (v as number) <= 0) {
      return { ok: false, mensaje: `${k} debe ser entero > 0 o null.` }
    }
    patch[k] = v
  }
  if ('espacio_vectorial' in body) {
    const v = texto(body, 'espacio_vectorial')
    patch.espacio_vectorial = v || null
  }
  for (const k of ['capacidades', 'params', 'precio'] as const) {
    if (!(k in body)) continue
    if (!esObjeto(body[k]) || contieneSecreto(body[k])) return { ok: false, mensaje: `${k} debe ser objeto JSON sin credenciales.` }
    patch[k] = body[k]
  }
  if ('activo' in body) {
    if (typeof body.activo !== 'boolean') {
      return { ok: false, mensaje: 'activo debe ser boolean.' }
    }
    patch.activo = body.activo
  }
  if ('notas' in body) patch.notas = texto(body, 'notas') || null
  if (Object.keys(patch).length === 0) {
    return { ok: false, mensaje: 'Nada que editar.' }
  }
  return { ok: true, datos: patch }
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

/** Asignación/activación de endpoint. `activo` es el switch de IA-008. */
export function patchEndpoint(endpoint: string, body: Record<string, unknown>): Validacion {
  if (!(ENDPOINTS as readonly string[]).includes(endpoint)) {
    return { ok: false, mensaje: `endpoint debe ser ${ENDPOINTS.join('|')}.` }
  }
  const patch: Record<string, unknown> = {}

  if ('modelo_id' in body) {
    const v = body.modelo_id
    if (v === null) {
      patch.modelo_id = null
    } else if (!esUuid(v)) {
      return { ok: false, mensaje: 'modelo_id debe ser uuid o null.' }
    } else {
      patch.modelo_id = v
    }
  }
  if ('habilitados' in body) {
    const v = body.habilitados
    if (!Array.isArray(v) || v.length > 8 || !v.every(esUuid)) {
      return { ok: false, mensaje: 'habilitados debe ser array de uuid (≤8).' }
    }
    patch.habilitados = v
  }
  if ('hereda' in body) {
    const v = body.hereda
    if (v === null) {
      patch.hereda = null
    } else if (endpoint !== 'query_rewrite' || v !== 'chat') {
      return { ok: false, mensaje: 'hereda debe ser un endpoint conocido o null.' }
    } else {
      patch.hereda = v
    }
  }
  if ('config' in body) {
    if (!esObjeto(body.config) || contieneSecreto(body.config)) return { ok: false, mensaje: 'config debe ser objeto JSON sin credenciales.' }
    patch.config = body.config
  }
  if ('activo' in body) {
    if (typeof body.activo !== 'boolean') {
      return { ok: false, mensaje: 'activo debe ser boolean.' }
    }
    patch.activo = body.activo
  }
  if (Object.keys(patch).length === 0) {
    return { ok: false, mensaje: 'Nada que editar (modelo_id, habilitados, hereda, config, activo).' }
  }
  return { ok: true, datos: patch }
}

// ---------------------------------------------------------------------------
// Salida segura: ninguna respuesta lleva material de clave
// ---------------------------------------------------------------------------

/** Proveedor para el frontend: sin clave_cifrada, con tiene_clave + máscara. */
export function sanearProveedor(row: Record<string, unknown>): Record<string, unknown> {
  const { clave_cifrada, ...rest } = row
  void clave_cifrada
  return { ...rest, tiene_clave: typeof row.tiene_clave === 'boolean' ? row.tiene_clave : row.clave_cifrada != null }
}

/** Elimina clave_cifrada (y clave si apareciera) de un objeto anidado para auditoría. */
export function sanearParaAuditoria(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sanearParaAuditoria)
  if (esObjeto(v)) {
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v)) {
      if (esCampoSecreto(k)) {
        out[k] = val == null ? null : '<protegida>'
      } else {
        out[k] = sanearParaAuditoria(val)
      }
    }
    return out
  }
  return v
}

function esCampoSecreto(k: string): boolean {
  return /^(clave|clave_cifrada|api[_-]?key|authorization|password|secret|access_token|ia_master_key)$/i.test(k)
}
function contieneSecreto(v: unknown): boolean {
  if (Array.isArray(v)) return v.some(contieneSecreto)
  if (esObjeto(v)) return Object.entries(v).some(([k, val]) => esCampoSecreto(k) || contieneSecreto(val))
  return false
}

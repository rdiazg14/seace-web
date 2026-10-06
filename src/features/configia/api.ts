import { supabase } from '../../lib/supabase'

export interface Proveedor {
  id: string
  nombre: string
  tipo_api: string
  base_url: string | null
  activo: boolean
  notas: string | null
  clave_mascara: string | null
  tiene_clave: boolean
  updated_at: string | null
}

export interface Modelo {
  id: string
  proveedor_id: string
  modelo: string
  tipo: string
  dimensiones: number | null
  espacio_vectorial: string | null
  contexto_max: number | null
  salida_max: number | null
  timeout_ms: number | null
  capacidades: Record<string, unknown> | null
  params: Record<string, unknown> | null
  precio: Record<string, unknown> | null
  activo: boolean
  notas: string | null
}

export interface Endpoint {
  endpoint: string
  modelo_id: string | null
  habilitados: string[] | null
  hereda: string | null
  config: Record<string, unknown> | null
  activo: boolean
  updated_at: string | null
}

export interface MetaRow { clave: string; valor: unknown; updated_at: string | null }

export interface Cambio {
  id: number
  user_id: string | null
  accion: string
  entidad: string
  antes: Record<string, unknown> | null
  despues: Record<string, unknown> | null
  created_at: string
}

export interface ConfigData {
  proveedores: Proveedor[]
  modelos: Modelo[]
  endpoints: Endpoint[]
  meta: MetaRow[]
}

export class ApiError extends Error {
  status: number
  constructor(mensaje: string, status: number) {
    super(mensaje)
    this.status = status
  }
}

async function leerError(error: { message: string; context?: Response }): Promise<ApiError> {
  try {
    if (error.context) {
      const j = await error.context.json() as { mensaje?: string; error?: string }
      return new ApiError(j.mensaje || j.error || error.message, error.context.status)
    }
  } catch {
    /* cuerpo no JSON */
  }
  return new ApiError(error.message, 0)
}

/** GET /functions/v1/config-ia — inventario completo sanitizado (admin). */
export async function obtenerConfig(): Promise<ConfigData> {
  const { data, error } = await supabase.functions.invoke<ConfigData>('config-ia', { method: 'GET' })
  if (error) throw await leerError(error)
  if (!data) throw new ApiError('Respuesta vacía de config-ia.', 0)
  return data
}

/** GET /config-ia/auditoria — últimas mutaciones de config. */
export async function obtenerAuditoria(): Promise<Cambio[]> {
  const { data, error } = await supabase.functions.invoke<{ cambios: Cambio[] }>('config-ia/auditoria', { method: 'GET' })
  if (error) throw await leerError(error)
  return data?.cambios ?? []
}

interface PatchResp {
  version_config: number
  endpoint?: Record<string, unknown>
  modelo?: Record<string, unknown>
  proveedor?: Record<string, unknown>
}

async function patch(ruta: string, body: Record<string, unknown>): Promise<PatchResp> {
  const { data, error } = await supabase.functions.invoke<PatchResp>(ruta, { method: 'PATCH', body })
  if (error) throw await leerError(error)
  if (!data) throw new ApiError('Respuesta vacía de config-ia.', 0)
  return data
}

export function patchEndpoint(nombre: string, body: Record<string, unknown>) {
  return patch(`config-ia/endpoints/${nombre}`, body)
}
export function patchModelo(id: string, body: Record<string, unknown>) {
  return patch(`config-ia/modelos/${id}`, body)
}
export function patchProveedor(id: string, body: Record<string, unknown>) {
  return patch(`config-ia/proveedores/${id}`, body)
}

import { supabase } from './supabase'
import type { ContratoRef } from '../types'

/** Fila de chat_sesiones (proyección usada por la lista lateral). */
export interface SesionChat {
  id: string
  titulo: string
  tokens_prompt: number
  tokens_completion: number
  n_mensajes: number
  updated_at: string
  contrato_id?: number | null
  /** SEC-006: uso registrado por el servidor (vista v_chat_sesiones_uso). Ausente si no se pudo leer. */
  uso?: UsoSesion
}

/** Total de una conversación según `uso_ia`; los tokens_* de la fila son copia del navegador. */
export interface UsoSesion {
  tokens: number
  requests_verificados: number
  mensajes_solo_declarados: number
}

/**
 * Cifra de tokens para las listas. Verificada solo si todas las respuestas con
 * tokens tienen registro del servidor; en cualquier otro caso se muestra la
 * copia guardada por el navegador rotulada como estimación.
 */
export function tokensSesion(s: SesionChat): { tokens: number; estimado: boolean } {
  const declarado = s.tokens_prompt + s.tokens_completion
  if (s.uso && s.uso.mensajes_solo_declarados === 0 && (s.uso.requests_verificados > 0 || declarado === 0)) {
    return { tokens: s.uso.tokens, estimado: false }
  }
  return { tokens: declarado, estimado: true }
}

/**
 * Añade el uso verificado a las sesiones listadas. Nunca lanza: sin la vista
 * (migración no aplicada) o ante un fallo, las sesiones quedan sin `uso` y la
 * lista sigue mostrando la estimación.
 */
async function conUsoVerificado(sesiones: SesionChat[]): Promise<SesionChat[]> {
  if (sesiones.length === 0) return sesiones
  const { data, error } = await supabase
    .from('v_chat_sesiones_uso')
    .select('sesion_id,tokens_prompt,tokens_completion,tokens_thoughts,requests_verificados,mensajes_solo_declarados')
    .in('sesion_id', sesiones.map(s => s.id))
  if (error || !Array.isArray(data)) return sesiones
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0)
  const porId = new Map<string, UsoSesion>()
  for (const fila of data as Record<string, unknown>[]) {
    if (typeof fila.sesion_id !== 'string') continue
    porId.set(fila.sesion_id, {
      tokens: num(fila.tokens_prompt) + num(fila.tokens_completion) + num(fila.tokens_thoughts),
      requests_verificados: num(fila.requests_verificados),
      mensajes_solo_declarados: num(fila.mensajes_solo_declarados),
    })
  }
  return sesiones.map(s => (porId.has(s.id) ? { ...s, uso: porId.get(s.id) } : s))
}

/** Fila de chat_mensajes persistida. */
export interface MensajeChat {
  id: number
  rol: 'user' | 'bot'
  texto: string
  refs: ContratoRef[] | null
  tokens_prompt: number
  tokens_completion: number
  error: boolean
  limit_flag: boolean
  /** Estado rico del mensaje (escenario, razonamiento, modelo, request_id, usage). */
  payload?: Record<string, unknown> | null
}

const COLS_SESION = 'id,titulo,tokens_prompt,tokens_completion,n_mensajes,updated_at,contrato_id'

export async function listarSesiones(userId: string): Promise<SesionChat[]> {
  const { data, error } = await supabase
    .from('chat_sesiones')
    .select(COLS_SESION)
    .eq('user_id', userId)
    .is('contrato_id', null)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return conUsoVerificado((data ?? []) as SesionChat[])
}

export async function listarSesionesContrato(
  userId: string,
  contratoId: number,
): Promise<SesionChat[]> {
  const { data, error } = await supabase
    .from('chat_sesiones')
    .select(COLS_SESION)
    .eq('user_id', userId)
    .eq('contrato_id', contratoId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return conUsoVerificado((data ?? []) as SesionChat[])
}

export async function crearSesion(
  userId: string,
  titulo: string,
  contratoId?: number | null,
): Promise<SesionChat> {
  const { data, error } = await supabase
    .from('chat_sesiones')
    .insert({ user_id: userId, titulo, contrato_id: contratoId ?? null })
    .select(COLS_SESION)
    .single()
  if (error) throw error
  return data as SesionChat
}

export async function borrarSesion(id: string): Promise<void> {
  const { error } = await supabase.from('chat_sesiones').delete().eq('id', id)
  if (error) throw error
}

export async function cargarMensajes(sesionId: string): Promise<MensajeChat[]> {
  const { data, error } = await supabase
    .from('chat_mensajes')
    .select('id,rol,texto,refs,tokens_prompt,tokens_completion,error,limit_flag,payload')
    .eq('sesion_id', sesionId)
    .order('id', { ascending: true })
  if (error) throw error
  return (data ?? []) as MensajeChat[]
}

export interface InsertarMensaje {
  sesion_id: string
  user_id: string
  rol: 'user' | 'bot'
  texto: string
  refs?: ContratoRef[] | null
  tokens_prompt?: number
  tokens_completion?: number
  error?: boolean
  limit_flag?: boolean
  payload?: Record<string, unknown> | null
}

export async function guardarMensaje(p: InsertarMensaje): Promise<void> {
  const { error } = await supabase.from('chat_mensajes').insert({
    sesion_id: p.sesion_id,
    user_id: p.user_id,
    rol: p.rol,
    texto: p.texto,
    refs: p.refs ?? null,
    tokens_prompt: p.tokens_prompt ?? 0,
    tokens_completion: p.tokens_completion ?? 0,
    error: p.error ?? false,
    limit_flag: p.limit_flag ?? false,
    payload: p.payload ?? null,
  })
  if (error) throw error
}

export interface ParcheSesion {
  titulo?: string
  tokens_prompt?: number
  tokens_completion?: number
  n_mensajes?: number
}

export async function actualizarSesion(id: string, patch: ParcheSesion): Promise<void> {
  const { error } = await supabase
    .from('chat_sesiones')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

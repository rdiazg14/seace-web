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
  return (data ?? []) as SesionChat[]
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
  return (data ?? []) as SesionChat[]
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

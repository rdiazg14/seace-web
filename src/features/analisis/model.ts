/** Reglas puras de la página de análisis: interpretación de POST /analizar y ancho del panel del asistente. */

import type { AnalisisResponse } from '../../lib/analisis'
import type { Contrato } from '../../types'

export interface RespuestaAnalizar {
  status: number
  ok: boolean
  payload: (AnalisisResponse & { error?: string; respuesta?: string; status?: string; mensaje?: string }) | null
}

export type ResultadoAnalizar =
  | { kind: 'datos'; data: AnalisisResponse }
  | { kind: 'error502' }
  | { kind: 'sinTdr'; mensaje: string }
  | { kind: 'error'; mensaje: string }

/** Traduce la respuesta del proxy al estado visible de la página. */
export function interpretarAnalizar({ status, ok, payload }: RespuestaAnalizar): ResultadoAnalizar {
  if (!payload) return status === 502 ? { kind: 'error502' } : { kind: 'error', mensaje: `HTTP ${status}` }
  if (status === 502 || payload.error === 'analisis_fallido') return { kind: 'error502' }
  if (status === 422 && payload.status === 'sin_tdr') {
    return { kind: 'sinTdr', mensaje: payload.mensaje || 'este contrato no tiene TDR suficiente para analizar' }
  }
  if (!ok) return { kind: 'error', mensaje: payload.respuesta || payload.mensaje || `HTTP ${status}` }
  if (payload.error && !payload.analisis) return { kind: 'error', mensaje: payload.mensaje || payload.error }
  return { kind: 'datos', data: payload }
}

export function pdfHashFicha(c: Pick<Contrato, 'pdf_hash'>): string {
  return (c.pdf_hash || '').trim() || 'na'
}

export const MIN_PANEL_W = 320
export const MAX_PANEL_W = 720
export const DEFAULT_PANEL_W = 380
export const CHAT_PANEL_STORAGE_KEY = 'seace_chat_panel_width'
export const DESKTOP_MQ = '(min-width: 1024px)'

/** Ancho máximo del panel: 720 px o la mitad de la ventana. */
export function maxPanelWidth(viewportWidth?: number): number {
  if (viewportWidth == null) return MAX_PANEL_W
  return Math.min(MAX_PANEL_W, Math.floor(viewportWidth * 0.5))
}

export function clampPanelWidth(w: number, viewportWidth?: number): number {
  return Math.min(maxPanelWidth(viewportWidth), Math.max(MIN_PANEL_W, w))
}

/** Ancho guardado válido o el predeterminado. */
export function anchoGuardado(saved: string | null, viewportWidth?: number): number {
  if (saved) {
    const n = Number(saved)
    if (Number.isFinite(n) && n > 0) return clampPanelWidth(n, viewportWidth)
  }
  return DEFAULT_PANEL_W
}

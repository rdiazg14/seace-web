import type { Cambio, Endpoint, Modelo } from './api'

/** Opciones del selector de modelo por endpoint: solo habilitados (contrato PLAN-004). */
export function modelosElegibles(ep: Endpoint, todos: Modelo[]): Modelo[] {
  const hab = ep.habilitados ?? []
  if (hab.length === 0) return []
  const set = new Set(hab)
  return todos.filter(m => set.has(m.id))
}

/** Resumen corto de un evento de auditoría (claves top-level, sin ruido). */
export function resumenCambio(c: Cambio): string {
  const src = (c.despues && Object.keys(c.despues).length ? c.despues : c.antes) ?? {}
  const ks = Object.keys(src).filter(k => !['updated_at', 'id'].includes(k)).slice(0, 4)
  return ks.length ? ks.map(k => `${k}: ${JSON.stringify(src[k])}`).join(', ').slice(0, 90) : '—'
}

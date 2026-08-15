import type { Contrato, ItemCubso } from '../types'

export const TZ = 'America/Lima'
export const SEACE_BASE = 'https://prod6.seace.gob.pe/buscador-publico/contrataciones'

export function limaDateISO(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

export function addCalendarDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return dt.toISOString().slice(0, 10)
}

export function dayOf(iso: string | null): string | null {
  if (!iso) return null
  return limaDateISO(new Date(iso))
}

export function diffDays(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T00:00:00Z`)
  const b = Date.parse(`${toIso}T00:00:00Z`)
  return Math.round((b - a) / 86400000)
}

export function fmtFecha(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: TZ,
  })
}

export function fmtFechaLarga(d = new Date()): string {
  return d.toLocaleDateString('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: TZ,
  })
}

export function haceCuanto(iso: string | null): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.max(0, Math.floor(diff / 60000))
  if (mins < 60) return mins <= 1 ? 'hace un momento' : `hace ${mins} min`
  const h = Math.floor(mins / 60)
  if (h < 24) return `hace ${h} h`
  const days = Math.floor(h / 24)
  if (days === 1) return 'ayer'
  if (days < 7) return `hace ${days} días`
  return fmtFecha(iso)
}

export type UrgenciaTone = 'hoy' | 'manana' | 'semana' | 'mes' | 'ok' | 'vencido' | 'sin'

export function cierraEn(iso: string | null): { label: string; tone: UrgenciaTone; days: number | null } {
  const day = dayOf(iso)
  if (!day) return { label: 'sin fecha', tone: 'sin', days: null }
  const today = limaDateISO()
  const days = diffDays(today, day)
  if (days < 0) return { label: 'vencido', tone: 'vencido', days }
  if (days === 0) return { label: 'hoy', tone: 'hoy', days }
  if (days === 1) return { label: 'mañana', tone: 'manana', days }
  if (days <= 7) return { label: `${days} días`, tone: 'semana', days }
  if (days <= 30) return { label: `${days} días`, tone: 'mes', days }
  return { label: `${days} días`, tone: 'ok', days }
}

export function nroContrato(c: Pick<Contrato, 'descripcion_contrato' | 'nro_contratacion' | 'id'>): string {
  const d = c.descripcion_contrato || ''
  if (/CM-|CS-|CP-/i.test(d)) return d
  return c.nro_contratacion || String(c.id)
}

export function seaceUrl(id: number): string {
  return `${SEACE_BASE}/${id}`
}

export function itemsDe(c: Contrato): ItemCubso[] {
  const raw = c.items_json
  if (!raw) return []
  return Array.isArray(raw) ? raw : []
}

export function tituloContrato(c: Contrato): string {
  return (c.descripcion || c.descripcion_contrato || '').replace(/\s+/g, ' ').trim()
}

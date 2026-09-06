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

export function parseIso(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Fin del día calendario Lima (Perú sin DST, UTC−5). */
export function limaEndOfDay(now = new Date()): Date {
  return new Date(`${limaDateISO(now)}T23:59:59.999-05:00`)
}

export function fmtHora(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return d.toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: TZ,
  })
}

export function fmtFechaHora(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const fecha = d.toLocaleDateString('es-PE', {
    day: 'numeric',
    month: 'short',
    timeZone: TZ,
  }).replace('.', '')
  return `${fecha} ${fmtHora(d)}`
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

/** `fecha_fin` entre ahora y el fin del día Lima de hoy. */
export function cierraHoyInstante(iso: string | null, ahora = new Date()): boolean {
  const fin = parseIso(iso)
  if (!fin) return false
  const t = fin.getTime()
  return t >= ahora.getTime() && t <= limaEndOfDay(ahora).getTime()
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

export function cierraEn(
  iso: string | null,
  ahora = new Date(),
): { label: string; tone: UrgenciaTone; days: number | null } {
  const fin = parseIso(iso)
  if (!fin) return { label: 'sin fecha', tone: 'sin', days: null }
  const day = dayOf(iso)
  const today = limaDateISO(ahora)
  const daysCal = day ? diffDays(today, day) : null
  const ms = fin.getTime() - ahora.getTime()
  if (ms < 0) return { label: 'Cerrado', tone: 'vencido', days: -1 }

  if (ms < 24 * 3600 * 1000) {
    const mins = Math.max(1, Math.round(ms / 60_000))
    const label = mins < 60 ? `Cierra en ${mins}min` : `Cierra en ${Math.max(1, Math.round(mins / 60))}h`
    return { label, tone: 'hoy', days: daysCal ?? 0 }
  }
  if (ms < 48 * 3600 * 1000) {
    return { label: `Cierra mañana ${fmtHora(fin)}`, tone: 'manana', days: daysCal ?? 1 }
  }

  const diaMes = fin.toLocaleDateString('es-PE', {
    day: 'numeric',
    month: 'short',
    timeZone: TZ,
  }).replace('.', '')
  const label = `Cierra el ${diaMes}`
  if (daysCal !== null && daysCal <= 7) return { label, tone: 'semana', days: daysCal }
  if (daysCal !== null && daysCal <= 30) return { label, tone: 'mes', days: daysCal }
  return { label, tone: 'ok', days: daysCal }
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

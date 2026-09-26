import { KEYWORD_CATS } from '../../lib/cats'

export interface KeywordRow {
  id: number
  categoria: string
  keyword: string
  tipo: string
  prioridad: number
  limite_palabra: boolean
  tolera_plural: boolean
  activa: boolean
  nota: string | null
  etiquetas: number
}

export interface CandidataRow {
  id: number
  senal: string
  categoria_propuesta: string
  veces_vista: number
  estado: string
  evidencia: Record<string, unknown> | null
}

export interface ColaRow {
  id: number
  contrato_id: number
  categoria_p1: string | null
  categoria_p2: string | null
  origen: string | null
  votos: Record<string, string> | null
  estado: string
  nota: string | null
  titulo: string | null
}

/** Categorías válidas sugeridas por P1/P2 y votos de Gemini, sin duplicados. */
export function catsSugeridas(r: ColaRow): string[] {
  const out: string[] = []
  for (const c of [r.categoria_p1, r.categoria_p2]) {
    if (c && c !== 'ninguna' && KEYWORD_CATS.includes(c as (typeof KEYWORD_CATS)[number])) {
      out.push(c)
    }
  }
  if (r.votos) {
    for (const v of Object.values(r.votos)) {
      if (v && v !== 'ninguna' && KEYWORD_CATS.includes(v as (typeof KEYWORD_CATS)[number])) {
        out.push(v)
      }
    }
  }
  return [...new Set(out)]
}

export type SortKey = 'etiquetas' | 'prioridad' | 'keyword' | 'categoria'

export type FiltroActiva = 'todas' | 'activas' | 'inactivas'

export function terminoDe(c: CandidataRow): string {
  const ev = c.evidencia
  const t = ev && typeof ev.termino === 'string' ? ev.termino : ''
  return (t || c.senal || '').trim()
}

export function senalOriginal(c: CandidataRow): string {
  const ev = c.evidencia
  const t = ev && typeof ev.senal_original === 'string' ? ev.senal_original : ''
  return (t || c.senal || '').trim()
}

/** Filtra por categoría/tipo/estado y ordena según la columna elegida. */
export function filtrarKeywords(
  rows: KeywordRow[],
  filtros: {
    categoria: string
    tipo: string
    activa: FiltroActiva
    sort: SortKey
    sortAsc: boolean
  },
): KeywordRow[] {
  let out = rows
  if (filtros.categoria) out = out.filter((r) => r.categoria === filtros.categoria)
  if (filtros.tipo) out = out.filter((r) => r.tipo === filtros.tipo)
  if (filtros.activa === 'activas') out = out.filter((r) => r.activa)
  if (filtros.activa === 'inactivas') out = out.filter((r) => !r.activa)
  const mul = filtros.sortAsc ? 1 : -1
  return [...out].sort((a, b) => {
    if (filtros.sort === 'etiquetas') return (a.etiquetas - b.etiquetas) * mul
    if (filtros.sort === 'prioridad') return (a.prioridad - b.prioridad) * mul
    if (filtros.sort === 'keyword') return a.keyword.localeCompare(b.keyword) * mul
    return a.categoria.localeCompare(b.categoria) * mul
  })
}

/** Próximo estado de orden al pulsar un encabezado: misma columna invierte, nueva usa su default. */
export function siguienteOrden(actual: SortKey, asc: boolean, nueva: SortKey): { sort: SortKey; sortAsc: boolean } {
  if (actual === nueva) return { sort: nueva, sortAsc: !asc }
  return { sort: nueva, sortAsc: nueva !== 'etiquetas' }
}

/** Umbral de confirmación explícita antes de crear/promover una keyword. */
export const UMBRAL_SIMULACION = 100

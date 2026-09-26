/**
 * Capa semántica ENERTRONIC (Dashboard).
 * Preferencia: vistas SQL (v_contratos_estado / v_kpis_*).
 * Fallback: mismas reglas en TS (esPostulable por instante + clasificarNivel) si las
 * vistas aún no están aplicadas.
 *
 * Postulable = instante (fecha_ini/fin vs now), igual que las vistas SQL
 * (v_contratos_estado / v_kpis_*, B22). Día Lima solo en tramos de cierre.
 * Rubro = clasificarNivel() ≡ fn_rubro_energetic en capa_semantica.sql
 */
import type { Contrato } from '../../types'
import {
  addCalendarDays,
  cierraHoyInstante,
  dayOf,
  limaDateISO,
} from '../../lib/format'
import {
  clasificarNivel,
  esPorAbrir,
  esPostulable,
  type NivelRubro,
} from '../rutadia/model'

export type RubroAgg = 'nucleo' | 'adyacente' | 'oportunista' | 'marginal' | 'sin_clasificar'

export interface LineaAgg {
  linea: string
  total: number
}

export interface RubroAggRow {
  rubro: RubroAgg
  total: number
}

export interface ContratoEstado extends Contrato {
  es_postulable: boolean
  es_vigente_ventana_vencida: boolean
  es_en_evaluacion: boolean
  cierra_hoy: boolean
  cierra_manana: boolean
  cierra_semana: boolean
  cierra_7d: boolean
  es_nuevo_hoy: boolean
  rubro: NivelRubro | null
}

export interface KpisDashboard {
  total_postulables: number
  cierran_hoy: number
  cierran_manana: number
  cierran_semana: number
  nuevos_hoy_postulables: number
  vigentes_ventana_vencida: number
  en_evaluacion: number
  altas_it_7d: number
  altas_it_7d_prev: number
  por_linea: LineaAgg[]
  por_rubro: RubroAggRow[]
}

export interface KpisNegocio {
  nucleo_postulables: number
  adyacente_postulables: number
  oportunista_postulables: number
  marginal_postulables: number
  nucleo_ia: number
  nucleo_cloud: number
  nucleo_dev: number
  nucleo_tel: number
  por_linea: LineaAgg[]
  por_rubro: RubroAggRow[]
}

export interface CapaSemantica {
  fuente: 'sql' | 'ts'
  kpis: KpisDashboard
  negocio: KpisNegocio
  postulables: ContratoEstado[]
  cerrados: ContratoEstado[]
}

/** 1 fila de v_kpis_conversion. Tasas 0..1; null = sin denominador (NULLIF). */
export interface KpisConversion {
  rankeados_30d: number
  postulables_30d: number
  analizados_30d: number
  cotizados_30d: number
  analizados_post_30d: number
  cotizados_post_30d: number
  cob_analisis: number | null
  cob_cotizacion: number | null
  cob_global: number | null
  eje_analisis: number | null
  eje_cotizacion: number | null
  eje_global: number | null
}

/** Fila de v_kpis_conversion_rubro. */
export interface KpisConversionRubro extends KpisConversion {
  rubro: RubroAgg
}

export function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null
}

export function asRecordList(v: unknown): Record<string, unknown>[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object' && !Array.isArray(x))
}

export function asInt(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

/** Tasa 0..1. null/NaN → null (no convertir a 0: 0% mentiría “fallé”). */
export function asRate(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/** Porcentaje para UI. null → "—" (sin datos), nunca "0%" por NULLIF. */
export function fmtTasa(v: number | null): string {
  if (v == null) return '—'
  const pct = v * 100
  return `${pct.toLocaleString('es-PE', { maximumFractionDigits: 2, minimumFractionDigits: 0 })}%`
}

export function asLineas(raw: unknown): LineaAgg[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((x) => {
      const o = x && typeof x === 'object' ? x as Record<string, unknown> : {}
      return { linea: String(o.linea ?? ''), total: asInt(o.total) }
    })
    .filter((x) => x.linea && x.total > 0)
}

export function asRubros(raw: unknown): RubroAggRow[] {
  if (!Array.isArray(raw)) return []
  const ok: RubroAgg[] = ['nucleo', 'adyacente', 'oportunista', 'marginal', 'sin_clasificar']
  return raw
    .map((x) => {
      const o = x && typeof x === 'object' ? x as Record<string, unknown> : {}
      const rubro = String(o.rubro ?? 'sin_clasificar') as RubroAgg
      return { rubro: ok.includes(rubro) ? rubro : 'sin_clasificar', total: asInt(o.total) }
    })
    .filter((x) => x.total > 0)
}

export function marcar(c: Contrato, ahora = new Date()): ContratoEstado {
  const today = limaDateISO(ahora)
  const d = dayOf(c.fecha_fin_cotizacion)
  const pub = dayOf(c.fecha_publica)
  const postulable = esPostulable(c, ahora)
  const porAbrir = esPorAbrir(c, ahora)
  const { nivel } = clasificarNivel(c)
  return {
    ...c,
    es_postulable: postulable,
    es_vigente_ventana_vencida: c.estado === 'Vigente' && !postulable && !porAbrir,
    es_en_evaluacion: c.estado === 'En Evaluación',
    cierra_hoy: postulable && cierraHoyInstante(c.fecha_fin_cotizacion, ahora),
    cierra_manana: postulable && d === addCalendarDays(today, 1),
    cierra_semana: postulable && !!d && d >= addCalendarDays(today, 2) && d <= addCalendarDays(today, 7),
    cierra_7d: postulable && !!d && d >= today && d <= addCalendarDays(today, 7),
    es_nuevo_hoy: pub === today,
    rubro: nivel,
  }
}

export function aggLinea(rows: ContratoEstado[]): LineaAgg[] {
  const map = new Map<string, number>()
  for (const r of rows) {
    if (!r.es_postulable) continue
    const k = r.categoria_it || '(sin línea)'
    map.set(k, (map.get(k) ?? 0) + 1)
  }
  return [...map.entries()].map(([linea, total]) => ({ linea, total })).sort((a, b) => b.total - a.total)
}

export function aggRubro(rows: ContratoEstado[]): RubroAggRow[] {
  const map = new Map<RubroAgg, number>()
  for (const r of rows) {
    if (!r.es_postulable) continue
    const k: RubroAgg = r.rubro ?? 'sin_clasificar'
    map.set(k, (map.get(k) ?? 0) + 1)
  }
  const order: RubroAgg[] = ['nucleo', 'adyacente', 'oportunista', 'marginal', 'sin_clasificar']
  return order.filter((k) => (map.get(k) ?? 0) > 0).map((rubro) => ({ rubro, total: map.get(rubro) ?? 0 }))
}

export function kpisDe(rows: ContratoEstado[], extra: { en_evaluacion: number; altas_it_7d: number; altas_it_7d_prev: number }): {
  kpis: KpisDashboard
  negocio: KpisNegocio
} {
  const post = rows.filter((r) => r.es_postulable)
  const por_linea = aggLinea(post)
  const por_rubro = aggRubro(post)
  const kpis: KpisDashboard = {
    total_postulables: post.length,
    cierran_hoy: post.filter((r) => r.cierra_hoy).length,
    cierran_manana: post.filter((r) => r.cierra_manana).length,
    cierran_semana: post.filter((r) => r.cierra_semana).length,
    nuevos_hoy_postulables: post.filter((r) => r.es_nuevo_hoy).length,
    vigentes_ventana_vencida: rows.filter((r) => r.es_vigente_ventana_vencida).length,
    en_evaluacion: extra.en_evaluacion,
    altas_it_7d: extra.altas_it_7d,
    altas_it_7d_prev: extra.altas_it_7d_prev,
    por_linea,
    por_rubro,
  }
  const negocio: KpisNegocio = {
    nucleo_postulables: post.filter((r) => r.rubro === 'nucleo').length,
    adyacente_postulables: post.filter((r) => r.rubro === 'adyacente').length,
    oportunista_postulables: post.filter((r) => r.rubro === 'oportunista').length,
    marginal_postulables: post.filter((r) => r.rubro === 'marginal').length,
    nucleo_ia: post.filter((r) => r.categoria_it === 'IA/analytics').length,
    nucleo_cloud: post.filter((r) => r.categoria_it === 'Cloud/hosting').length,
    nucleo_dev: post.filter((r) => r.categoria_it === 'Desarrollo software').length,
    nucleo_tel: post.filter((r) => clasificarNivel(r).overlay === 'telemetria').length,
    por_linea,
    por_rubro,
  }
  return { kpis, negocio }
}

export function parseEstadoRow(raw: Record<string, unknown>): ContratoEstado {
  const c = raw as unknown as Contrato
  const rubro = clasificarNivel(c).nivel
  return {
    ...c,
    es_postulable: raw.es_postulable === true,
    es_vigente_ventana_vencida: raw.es_vigente_ventana_vencida === true,
    es_en_evaluacion: raw.es_en_evaluacion === true,
    cierra_hoy: raw.cierra_hoy === true,
    cierra_manana: raw.cierra_manana === true,
    cierra_semana: raw.cierra_semana === true,
    cierra_7d: raw.cierra_7d === true,
    es_nuevo_hoy: raw.es_nuevo_hoy === true,
    rubro,
  }
}

export function parseKpis(row: Record<string, unknown>): KpisDashboard {
  return {
    total_postulables: asInt(row.total_postulables),
    cierran_hoy: asInt(row.cierran_hoy),
    cierran_manana: asInt(row.cierran_manana),
    cierran_semana: asInt(row.cierran_semana),
    nuevos_hoy_postulables: asInt(row.nuevos_hoy_postulables),
    vigentes_ventana_vencida: asInt(row.vigentes_ventana_vencida),
    en_evaluacion: asInt(row.en_evaluacion),
    altas_it_7d: asInt(row.altas_it_7d),
    altas_it_7d_prev: asInt(row.altas_it_7d_prev),
    por_linea: asLineas(row.por_linea),
    por_rubro: asRubros(row.por_rubro),
  }
}

export function parseConversionCounts(row: Record<string, unknown>): KpisConversion {
  return {
    rankeados_30d: asInt(row.rankeados_30d),
    postulables_30d: asInt(row.postulables_30d),
    analizados_30d: asInt(row.analizados_30d),
    cotizados_30d: asInt(row.cotizados_30d),
    analizados_post_30d: asInt(row.analizados_post_30d),
    cotizados_post_30d: asInt(row.cotizados_post_30d),
    cob_analisis: asRate(row.cob_analisis),
    cob_cotizacion: asRate(row.cob_cotizacion),
    cob_global: asRate(row.cob_global),
    eje_analisis: asRate(row.eje_analisis),
    eje_cotizacion: asRate(row.eje_cotizacion),
    eje_global: asRate(row.eje_global),
  }
}

export const RUBRO_ORDEN: RubroAgg[] = ['nucleo', 'adyacente', 'oportunista', 'marginal', 'sin_clasificar']

export function parseConversionRubro(row: Record<string, unknown>): KpisConversionRubro {
  const rubroRaw = String(row.rubro ?? 'sin_clasificar') as RubroAgg
  return {
    rubro: RUBRO_ORDEN.includes(rubroRaw) ? rubroRaw : 'sin_clasificar',
    ...parseConversionCounts(row),
  }
}

export function parseNegocio(row: Record<string, unknown>): KpisNegocio {
  return {
    nucleo_postulables: asInt(row.nucleo_postulables),
    adyacente_postulables: asInt(row.adyacente_postulables),
    oportunista_postulables: asInt(row.oportunista_postulables),
    marginal_postulables: asInt(row.marginal_postulables),
    nucleo_ia: asInt(row.nucleo_ia),
    nucleo_cloud: asInt(row.nucleo_cloud),
    nucleo_dev: asInt(row.nucleo_dev),
    nucleo_tel: asInt(row.nucleo_tel),
    por_linea: asLineas(row.por_linea),
    por_rubro: asRubros(row.por_rubro),
  }
}

export function tendenciaPct(cur: number, prev: number): number {
  if (prev === 0) return cur > 0 ? 100 : 0
  return Math.round(((cur - prev) / prev) * 100)
}

export const RUBRO_LABEL: Record<RubroAgg, string> = {
  nucleo: 'Núcleo',
  adyacente: 'Adyacente',
  oportunista: 'Oportunista',
  marginal: 'Marginal',
  sin_clasificar: 'Sin clasificar',
}

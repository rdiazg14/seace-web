/**
 * Capa semántica ENERTRONIC (Dashboard).
 * Preferencia: vistas SQL (v_contratos_estado / v_kpis_*).
 * Fallback: mismas reglas en TS (esPostulable + clasificarNivel) si las
 * vistas aún no están aplicadas.
 *
 * Día Lima = limaDateISO / timezone America/Lima.
 * Rubro = clasificarNivel() ≡ fn_rubro_energetic en capa_semantica.sql
 */
import { supabase } from './supabase'
import type { Contrato } from '../types'
import {
  addCalendarDays,
  dayOf,
  limaDateISO,
} from './format'
import {
  clasificarNivel,
  esPostulable,
  RUTA_DIA_COLS,
  type NivelRubro,
} from './rutaDia'

const IT_OR = 'categoria_it.not.is.null,relevancia_ia.not.is.null'

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

const ESTADO_COLS = `${RUTA_DIA_COLS},es_postulable,es_vigente_ventana_vencida,es_en_evaluacion,cierra_hoy,cierra_manana,cierra_semana,cierra_7d,es_nuevo_hoy,rubro`

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null
}

function asRecordList(v: unknown): Record<string, unknown>[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object' && !Array.isArray(x))
}

function asInt(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function asLineas(raw: unknown): LineaAgg[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((x) => {
      const o = x && typeof x === 'object' ? x as Record<string, unknown> : {}
      return { linea: String(o.linea ?? ''), total: asInt(o.total) }
    })
    .filter((x) => x.linea && x.total > 0)
}

function asRubros(raw: unknown): RubroAggRow[] {
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

function marcar(c: Contrato, today = limaDateISO()): ContratoEstado {
  const d = dayOf(c.fecha_fin_cotizacion)
  const pub = dayOf(c.fecha_publica)
  const postulable = esPostulable(c, today)
  const { nivel } = clasificarNivel(c)
  return {
    ...c,
    es_postulable: postulable,
    es_vigente_ventana_vencida: c.estado === 'Vigente' && !postulable,
    es_en_evaluacion: c.estado === 'En Evaluación',
    cierra_hoy: postulable && d === today,
    cierra_manana: postulable && d === addCalendarDays(today, 1),
    cierra_semana: postulable && !!d && d >= addCalendarDays(today, 2) && d <= addCalendarDays(today, 7),
    cierra_7d: postulable && !!d && d >= today && d <= addCalendarDays(today, 7),
    es_nuevo_hoy: pub === today,
    rubro: nivel,
  }
}

function aggLinea(rows: ContratoEstado[]): LineaAgg[] {
  const map = new Map<string, number>()
  for (const r of rows) {
    if (!r.es_postulable) continue
    const k = r.categoria_it || '(sin línea)'
    map.set(k, (map.get(k) ?? 0) + 1)
  }
  return [...map.entries()].map(([linea, total]) => ({ linea, total })).sort((a, b) => b.total - a.total)
}

function aggRubro(rows: ContratoEstado[]): RubroAggRow[] {
  const map = new Map<RubroAgg, number>()
  for (const r of rows) {
    if (!r.es_postulable) continue
    const k: RubroAgg = r.rubro ?? 'sin_clasificar'
    map.set(k, (map.get(k) ?? 0) + 1)
  }
  const order: RubroAgg[] = ['nucleo', 'adyacente', 'oportunista', 'marginal', 'sin_clasificar']
  return order.filter((k) => (map.get(k) ?? 0) > 0).map((rubro) => ({ rubro, total: map.get(rubro) ?? 0 }))
}

function kpisDe(rows: ContratoEstado[], extra: { en_evaluacion: number; altas_it_7d: number; altas_it_7d_prev: number }): {
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

function parseEstadoRow(raw: Record<string, unknown>): ContratoEstado {
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

function parseKpis(row: Record<string, unknown>): KpisDashboard {
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

function parseNegocio(row: Record<string, unknown>): KpisNegocio {
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

async function countIt(filters: { gtePub?: string; ltPub?: string; estado?: string }): Promise<number> {
  let q = supabase.from('contratos').select('id', { count: 'exact', head: true }).or(IT_OR)
  if (filters.estado) q = q.eq('estado', filters.estado)
  if (filters.gtePub) q = q.gte('fecha_publica', filters.gtePub)
  if (filters.ltPub) q = q.lt('fecha_publica', filters.ltPub)
  const { count, error } = await q
  if (error) throw error
  return count ?? 0
}

/** Inicio del día Lima como timestamptz (Perú sin DST, UTC-5). */
function limaDayStartIso(isoDate: string): string {
  return `${isoDate}T00:00:00-05:00`
}

async function fetchCapaSql(): Promise<CapaSemantica | null> {
  const [kpisRes, negRes, postRes, cerrRes] = await Promise.all([
    supabase.from('v_kpis_dashboard').select('*').limit(1),
    supabase.from('v_kpis_negocio').select('*').limit(1),
    supabase.from('v_contratos_estado').select(ESTADO_COLS)
      .eq('es_postulable', true)
      .order('fecha_fin_cotizacion', { ascending: true, nullsFirst: false })
      .limit(800),
    supabase.from('v_contratos_estado').select(ESTADO_COLS)
      .or('es_en_evaluacion.eq.true,es_vigente_ventana_vencida.eq.true')
      .order('fecha_fin_cotizacion', { ascending: false, nullsFirst: false })
      .limit(800),
  ])
  if (kpisRes.error || !kpisRes.data?.[0]) return null
  if (negRes.error || postRes.error) return null
  const kpisRow = asRecord(kpisRes.data[0])
  if (!kpisRow) return null
  const kpis = parseKpis(kpisRow)
  const negRow = asRecord(negRes.data?.[0])
  const negocio = negRow
    ? parseNegocio(negRow)
    : {
        nucleo_postulables: 0,
        adyacente_postulables: 0,
        oportunista_postulables: 0,
        marginal_postulables: 0,
        nucleo_ia: 0,
        nucleo_cloud: 0,
        nucleo_dev: 0,
        nucleo_tel: 0,
        por_linea: kpis.por_linea,
        por_rubro: kpis.por_rubro,
      }
  return {
    fuente: 'sql',
    kpis,
    negocio,
    postulables: asRecordList(postRes.data).map(parseEstadoRow),
    cerrados: cerrRes.error ? [] : asRecordList(cerrRes.data).map(parseEstadoRow),
  }
}

async function fetchCapaTs(): Promise<CapaSemantica> {
  const today = limaDateISO()
  const d7 = addCalendarDays(today, -6)
  const d14 = addCalendarDays(today, -13)
  const [vig, evalRows, enEval, altas7, altasPrev] = await Promise.all([
    supabase.from('contratos').select(RUTA_DIA_COLS)
      .eq('estado', 'Vigente').or(IT_OR)
      .order('fecha_fin_cotizacion', { ascending: true, nullsFirst: false })
      .limit(800),
    supabase.from('contratos').select(RUTA_DIA_COLS)
      .eq('estado', 'En Evaluación').or(IT_OR)
      .order('fecha_fin_cotizacion', { ascending: false, nullsFirst: false })
      .limit(800),
    countIt({ estado: 'En Evaluación' }),
    countIt({ gtePub: limaDayStartIso(d7) }),
    countIt({ gtePub: limaDayStartIso(d14), ltPub: limaDayStartIso(d7) }),
  ])
  if (vig.error) throw vig.error
  const vigentes = asRecordList(vig.data) as unknown as Contrato[]
  const evaluacion = evalRows.error ? [] : asRecordList(evalRows.data) as unknown as Contrato[]
  const markedVig = vigentes.map((c) => marcar(c, today))
  const markedEval = evaluacion.map((c) => marcar(c, today))
  const { kpis, negocio } = kpisDe(markedVig, {
    en_evaluacion: enEval,
    altas_it_7d: altas7,
    altas_it_7d_prev: altasPrev,
  })
  return {
    fuente: 'ts',
    kpis,
    negocio,
    postulables: markedVig.filter((r) => r.es_postulable),
    cerrados: [
      ...markedEval,
      ...markedVig.filter((r) => r.es_vigente_ventana_vencida),
    ],
  }
}

export async function cargarCapaSemantica(): Promise<CapaSemantica> {
  try {
    const sql = await fetchCapaSql()
    if (sql) return sql
  } catch {
    /* vistas no aplicadas aún */
  }
  return fetchCapaTs()
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

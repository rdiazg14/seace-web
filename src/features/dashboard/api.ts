/**
 * Acceso a datos de la capa semántica (Dashboard).
 * Preferencia: vistas SQL (v_contratos_estado / v_kpis_*).
 * Fallback: mismas reglas en TS (esPostulable por instante + clasificarNivel) si las
 * vistas aún no están aplicadas.
 */
import { supabase } from '../../lib/supabase'
import type { Contrato } from '../../types'
import {
  addCalendarDays,
  limaDateISO,
} from '../../lib/format'
import { RUTA_DIA_BASE_COLS, RUTA_DIA_COLS } from '../rutadia/model'
import {
  asRecord,
  asRecordList,
  kpisDe,
  marcar,
  parseConversionCounts,
  parseConversionRubro,
  parseEstadoRow,
  parseKpis,
  parseNegocio,
  RUBRO_ORDEN,
  type CapaSemantica,
  type KpisConversion,
  type KpisConversionRubro,
} from './model'

const IT_OR = 'categoria_it.not.is.null,relevancia_ia.not.is.null'

const ESTADO_COLS = `${RUTA_DIA_BASE_COLS.join(',')},es_postulable,es_vigente_ventana_vencida,es_en_evaluacion,cierra_hoy,cierra_manana,cierra_semana,cierra_7d,es_nuevo_hoy,rubro`

async function countIt(filters: { gtePub?: string; ltPub?: string; estado?: string }): Promise<number> {
  let q = supabase.from('v_contratos').select('id', { count: 'exact', head: true }).or(IT_OR)
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
    supabase.from('v_contratos').select(RUTA_DIA_COLS)
      .eq('estado', 'Vigente').or(IT_OR)
      .order('fecha_fin_cotizacion', { ascending: true, nullsFirst: false })
      .limit(800),
    supabase.from('v_contratos').select(RUTA_DIA_COLS)
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
  const markedVig = vigentes.map((c) => marcar(c))
  const markedEval = evaluacion.map((c) => marcar(c))
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

/** Funnel 30d. Falla suave: null si las vistas no existen o el fetch falla. */
export async function cargarKpisConversion(): Promise<{
  global: KpisConversion
  rubros: KpisConversionRubro[]
} | null> {
  try {
    const [gRes, rRes] = await Promise.all([
      supabase.from('v_kpis_conversion').select('*').limit(1),
      supabase.from('v_kpis_conversion_rubro').select('*'),
    ])
    if (gRes.error || !gRes.data?.[0]) return null
    const row = asRecord(gRes.data[0])
    if (!row) return null
    const rubros = asRecordList(rRes.error ? [] : rRes.data)
      .map(parseConversionRubro)
      .sort((a, b) => RUBRO_ORDEN.indexOf(a.rubro) - RUBRO_ORDEN.indexOf(b.rubro))
    return { global: parseConversionCounts(row), rubros }
  } catch {
    return null
  }
}

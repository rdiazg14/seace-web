import { describe, expect, it } from 'vitest'
import type { Contrato } from '../../types'
import {
  asInt,
  asRate,
  barrasCategorias,
  comparacionCategorias,
  contratosPorTipoEntidad,
  filtrarOportunidades,
  fmtTasa,
  kpisDe,
  marcar,
  parseConversionCounts,
  parseEstadoRow,
  parseKpis,
  resumenPorMes,
  resumenPorObjeto,
  RUBRO_LABEL,
  seriesPorCategoria,
  tendenciaPct,
  topEntidades,
} from './model'

/** Viernes 26/09/2026 15:00 Lima (UTC−5). */
const AHORA = new Date('2026-09-26T15:00:00-05:00')

function mkContrato(over: Partial<Contrato> = {}): Contrato {
  return {
    id: 1,
    nro_contratacion: 'N° 001',
    descripcion_contrato: '',
    objeto: 'Servicio',
    descripcion: 'Servicio genérico',
    entidad: 'Entidad X',
    estado: 'Vigente',
    fecha_publica: '2026-09-25T10:00:00-05:00',
    fecha_ini_cotizacion: '2026-09-20T08:00:00-05:00',
    fecha_fin_cotizacion: '2026-10-05T23:59:00-05:00',
    tipo_cotizacion: null,
    cotizar: null,
    categoria_it: 'IA/analytics',
    relevancia_ia: 'ALTA',
    ...over,
  }
}

describe('capa semántica — reglas exportadas', () => {
  it('fmtTasa: null → — (sin datos), nunca inventa 0%', () => {
    expect(fmtTasa(null)).toBe('—')
    expect(fmtTasa(0.5)).toBe('50%')
    expect(fmtTasa(0.123)).toMatch(/^12[.,]3%$/)
    expect(fmtTasa(0)).toBe('0%')
  })

  it('tendenciaPct: prev 0 → 100 si hay actual, 0 si no', () => {
    expect(tendenciaPct(5, 0)).toBe(100)
    expect(tendenciaPct(0, 0)).toBe(0)
    expect(tendenciaPct(15, 10)).toBe(50)
    expect(tendenciaPct(5, 10)).toBe(-50)
  })

  it('RUBRO_LABEL cubre los cinco rubros', () => {
    expect(Object.keys(RUBRO_LABEL).sort()).toEqual(
      ['adyacente', 'marginal', 'nucleo', 'oportunista', 'sin_clasificar'].sort(),
    )
    expect(RUBRO_LABEL.nucleo).toBe('Núcleo')
  })
})

describe('marcar — flags de estado del contrato', () => {
  it('postulable vigente con ventana abierta; tramos de cierre por día Lima', () => {
    const hoy = marcar(mkContrato({
      fecha_publica: '2026-09-26T08:00:00-05:00',
      fecha_fin_cotizacion: '2026-09-26T20:00:00-05:00',
    }), AHORA)
    expect(hoy.es_postulable).toBe(true)
    expect(hoy.cierra_hoy).toBe(true)
    expect(hoy.es_nuevo_hoy).toBe(true)
    expect(hoy.rubro).toBe('nucleo')

    const manana = marcar(mkContrato({ fecha_fin_cotizacion: '2026-09-27T20:00:00-05:00' }), AHORA)
    expect(manana.cierra_manana).toBe(true)
    expect(manana.cierra_hoy).toBe(false)

    const semana = marcar(mkContrato({ fecha_fin_cotizacion: '2026-09-30T20:00:00-05:00' }), AHORA)
    expect(semana.cierra_semana).toBe(true)
    expect(semana.cierra_7d).toBe(true)
  })

  it('vigente vencido y por abrir no son postulables', () => {
    const vencido = marcar(mkContrato({ fecha_fin_cotizacion: '2026-09-20T20:00:00-05:00' }), AHORA)
    expect(vencido.es_postulable).toBe(false)
    expect(vencido.es_vigente_ventana_vencida).toBe(true)
    const porAbrir = marcar(mkContrato({ fecha_ini_cotizacion: '2026-09-30T08:00:00-05:00' }), AHORA)
    expect(porAbrir.es_postulable).toBe(false)
    expect(porAbrir.es_vigente_ventana_vencida).toBe(false)
  })

  it('En Evaluación se marca y no es postulable', () => {
    const r = marcar(mkContrato({ estado: 'En Evaluación' }), AHORA)
    expect(r.es_en_evaluacion).toBe(true)
    expect(r.es_postulable).toBe(false)
  })
})

describe('kpisDe — KPIs del dashboard', () => {
  it('agrega postulables, cierres, nuevos y rubros sobre filas marcadas', () => {
    const rows = [
      marcar(mkContrato({ id: 1, fecha_publica: '2026-09-26T08:00:00-05:00', fecha_fin_cotizacion: '2026-09-26T20:00:00-05:00' }), AHORA),
      marcar(mkContrato({ id: 2, categoria_it: 'Hardware', fecha_fin_cotizacion: '2026-09-27T20:00:00-05:00' }), AHORA),
      marcar(mkContrato({ id: 3, fecha_fin_cotizacion: '2026-09-20T20:00:00-05:00' }), AHORA),
    ]
    const { kpis, negocio } = kpisDe(rows, { en_evaluacion: 4, altas_it_7d: 9, altas_it_7d_prev: 3 })
    expect(kpis.total_postulables).toBe(2)
    expect(kpis.cierran_hoy).toBe(1)
    expect(kpis.cierran_manana).toBe(1)
    expect(kpis.nuevos_hoy_postulables).toBe(1)
    expect(kpis.vigentes_ventana_vencida).toBe(1)
    expect(kpis.en_evaluacion).toBe(4)
    expect(kpis.altas_it_7d).toBe(9)
    expect(negocio.nucleo_postulables).toBe(1)
    expect(negocio.marginal_postulables).toBe(1)
    expect(negocio.nucleo_ia).toBe(1)
  })
})

describe('parseo defensivo de filas SQL', () => {
  it('asInt/asRate normalizan y no inventan datos', () => {
    expect(asInt('7')).toBe(7)
    expect(asInt('x')).toBe(0)
    expect(asInt(null)).toBe(0)
    expect(asRate('0.5')).toBe(0.5)
    expect(asRate(null)).toBeNull()
    expect(asRate('x')).toBeNull()
  })

  it('parseKpis filtra líneas/rubros vacíos o a cero', () => {
    const k = parseKpis({
      total_postulables: '3',
      por_linea: [{ linea: 'IA/analytics', total: '2' }, { linea: '', total: 9 }, { linea: 'X', total: 0 }],
      por_rubro: [{ rubro: 'nucleo', total: 2 }, { rubro: 'desconocido', total: 5 }, { rubro: 'marginal', total: 0 }],
    })
    expect(k.total_postulables).toBe(3)
    expect(k.por_linea).toEqual([{ linea: 'IA/analytics', total: 2 }])
    expect(k.por_rubro).toEqual([
      { rubro: 'nucleo', total: 2 },
      { rubro: 'sin_clasificar', total: 5 },
    ])
  })

  it('parseConversionCounts conserva null en tasas sin denominador', () => {
    const c = parseConversionCounts({ rankeados_30d: 10, cob_analisis: null, eje_global: '0.25' })
    expect(c.rankeados_30d).toBe(10)
    expect(c.cob_analisis).toBeNull()
    expect(c.eje_global).toBe(0.25)
  })

  it('parseEstadoRow toma flags tal cual y recalcula el rubro', () => {
    const r = parseEstadoRow({ ...mkContrato(), es_postulable: true, cierra_hoy: 'no' } as unknown as Record<string, unknown>)
    expect(r.es_postulable).toBe(true)
    expect(r.cierra_hoy).toBe(false)
    expect(r.rubro).toBe('nucleo')
  })
})

describe('derivaciones de presentación del Dashboard', () => {
  const postulables = [
    marcar(mkContrato({ id: 1, entidad: 'Ministerio A', fecha_fin_cotizacion: '2026-09-26T20:00:00-05:00' }), AHORA),
    marcar(mkContrato({ id: 2, entidad: 'Ministerio A', categoria_it: 'Cloud/hosting', fecha_fin_cotizacion: '2026-09-27T20:00:00-05:00' }), AHORA),
    marcar(mkContrato({ id: 3, entidad: 'Municipalidad B', categoria_it: 'Hardware', fecha_fin_cotizacion: '2026-10-10T20:00:00-05:00' }), AHORA),
  ]

  it('agrupa meses, objetos y series por categoría sin mutar la entrada', () => {
    const resumen = [
      { objeto: 'Servicio', estado: 'Vigente', categoria_it: 'IA/analytics', mes: '2026-08-01', total: 2 },
      { objeto: 'Servicio', estado: 'Vigente', categoria_it: 'IA/analytics', mes: '2026-09-01', total: 3 },
      { objeto: 'Bien', estado: 'Vigente', categoria_it: 'Hardware', mes: '2026-09-01', total: 1 },
    ]
    expect(resumenPorMes(resumen)[8]).toEqual({ mes: 'Sep', total: 4 })
    expect(resumenPorObjeto(resumen)).toEqual([
      { name: 'Servicio', value: 5, pct: 83 },
      { name: 'Bien', value: 1, pct: 17 },
    ])
    const series = seriesPorCategoria(resumen, ['IA/analytics'])
    expect(series[7]['IA/analytics']).toBe(2)
    expect(series[8]['IA/analytics']).toBe(3)
  })

  it('calcula comparación mensual con reloj inyectado', () => {
    const categorias = [{ linea: 'IA/analytics', id: 'IA/analytics', label: 'IA', total: 3 }]
    const resumen = [
      { objeto: 'Servicio', estado: 'Vigente', categoria_it: 'IA/analytics', mes: '2026-08-01', total: 2 },
      { objeto: 'Servicio', estado: 'Vigente', categoria_it: 'IA/analytics', mes: '2026-09-01', total: 3 },
    ]
    const series = seriesPorCategoria(resumen, ['IA/analytics'])
    expect(comparacionCategorias(categorias, resumen, series, AHORA)[0]).toMatchObject({ cur: 3, ant: 2, pct: 50 })
  })

  it('filtra la lista por categoría, urgencia y vista', () => {
    expect(filtrarOportunidades(postulables, { categoria: 'IA/analytics', urgencia: 'hoy', vista: 'postulable' }).map((r) => r.id)).toEqual([1])
    expect(filtrarOportunidades(postulables, { categoria: null, urgencia: 'semana', vista: 'postulable' }).map((r) => r.id)).toEqual([1, 2])
    expect(filtrarOportunidades(postulables, { categoria: null, urgencia: 'todos', vista: 'cerrados' })).toHaveLength(3)
  })

  it('deriva barras, entidades y tipos desde contratos', () => {
    const kpis = { ...kpisDe(postulables, { en_evaluacion: 0, altas_it_7d: 0, altas_it_7d_prev: 0 }).kpis }
    expect(barrasCategorias(kpis)[0]).toMatchObject({ id: 'IA/analytics', total: 1 })
    expect(topEntidades(postulables)[0]).toEqual({ name: 'Ministerio A', total: 2 })
    expect(contratosPorTipoEntidad(postulables).reduce((sum, r) => sum + r.total, 0)).toBe(3)
  })
})

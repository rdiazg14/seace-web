import { describe, expect, it } from 'vitest'
import type { Contrato } from '../../types'
import {
  asInt,
  asRate,
  fmtTasa,
  kpisDe,
  marcar,
  parseConversionCounts,
  parseEstadoRow,
  parseKpis,
  RUBRO_LABEL,
  tendenciaPct,
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

import { describe, expect, it } from 'vitest'
import {
  agruparConvocatorias,
  etiquetaConvocatoria,
  ordinalConvocatoria,
  resultadoDe,
  type ConvocatoriaFila,
} from './convocatorias'

function fila(over: Partial<ConvocatoriaFila>): ConvocatoriaFila {
  return {
    contrato_id: 1,
    convocatoria_id: 1,
    numero: 1,
    total: 1,
    es_actual: false,
    nro_contratacion: null,
    descripcion_contrato: null,
    estado: 'Culminado',
    fecha_publica: null,
    fecha_ini_cotizacion: null,
    fecha_fin_cotizacion: null,
    resultado: null,
    proveedor_ganador: null,
    monto_adjudicado: null,
    pdf_archivo_id: null,
    pdf_storage_path: null,
    ...over,
  }
}

/** Grupo visto desde `contratoId`: una fila por convocatoria con su resultado. */
function grupo(contratoId: number, resultados: (string | null)[], actual: number): ConvocatoriaFila[] {
  return resultados.map((resultado, i) => fila({
    contrato_id: contratoId,
    convocatoria_id: contratoId * 100 + i + 1,
    numero: i + 1,
    total: resultados.length,
    es_actual: i + 1 === actual,
    resultado,
  }))
}

describe('convocatorias del mismo requerimiento', () => {
  it('resultadoDe normaliza el texto del portal', () => {
    expect(resultadoDe({ resultado: 'DESIERTO' })).toBe('desierto')
    expect(resultadoDe({ resultado: ' adjudicado ' })).toBe('adjudicado')
    expect(resultadoDe({ resultado: null })).toBe('sin_resultado')
    expect(resultadoDe({ resultado: 'CANCELADO' })).toBe('sin_resultado')
  })

  it('agrupa por proceso, ordena por número y cuenta solo las anteriores', () => {
    // Llegan desordenadas y mezcladas con otro proceso.
    const filas = [
      ...grupo(7, ['DESIERTO', 'DESIERTO', null, 'ADJUDICADO'], 3).reverse(),
      ...grupo(8, ['ADJUDICADO', null], 2),
    ]
    const mapa = agruparConvocatorias(filas)
    const r = mapa.get(7)
    expect(r).toMatchObject({
      numero: 3,
      total: 4,
      previas: 2,
      desiertasPrevias: 2,
      adjudicadasPrevias: 0,
      sinResultadoPrevias: 0,
    })
    expect(r?.filas.map(f => f.numero)).toEqual([1, 2, 3, 4])
    // La 4.ª es posterior a este proceso: no cuenta como antecedente.
    expect(mapa.get(8)).toMatchObject({ numero: 2, previas: 1, adjudicadasPrevias: 1 })
  })

  it('descarta grupos de una sola fila o sin la fila del propio proceso', () => {
    const sola = grupo(1, [null], 1)
    const sinActual = grupo(2, ['DESIERTO', null], 0)
    const mapa = agruparConvocatorias([...sola, ...sinActual])
    expect(mapa.size).toBe(0)
  })

  it('la primera convocatoria no lleva etiqueta aunque haya posteriores', () => {
    const r = agruparConvocatorias(grupo(1, [null, 'DESIERTO'], 1)).get(1)
    expect(r?.numero).toBe(1)
    expect(etiquetaConvocatoria(r)).toBeNull()
    expect(etiquetaConvocatoria(null)).toBeNull()
  })

  it('la etiqueta dice qué pasó antes', () => {
    const etiqueta = (resultados: (string | null)[]) =>
      etiquetaConvocatoria(agruparConvocatorias(grupo(1, resultados, resultados.length)).get(1))
    expect(etiqueta(['DESIERTO', null])).toEqual({ texto: '2.ª convocatoria · anterior desierta', tono: 'desierta' })
    expect(etiqueta(['DESIERTO', 'DESIERTO', null])).toEqual({ texto: '3.ª convocatoria · 2 desiertas', tono: 'desierta' })
    expect(etiqueta(['DESIERTO', null, 'ADJUDICADO', null]))
      .toEqual({ texto: '4.ª convocatoria · 1 de 3 desiertas', tono: 'desierta' })
    expect(etiqueta(['ADJUDICADO', null])).toEqual({ texto: '2.ª convocatoria · anterior adjudicada', tono: 'adjudicada' })
    expect(etiqueta(['ADJUDICADO', null, null]))
      .toEqual({ texto: '3.ª convocatoria · 1 de 2 adjudicadas', tono: 'adjudicada' })
    expect(etiqueta([null, null])).toEqual({ texto: '2.ª convocatoria · anterior sin resultado', tono: 'neutro' })
    expect(etiqueta([null, null, null])).toEqual({ texto: '3.ª convocatoria · anteriores sin resultado', tono: 'neutro' })
  })

  it('ordinalConvocatoria usa el ordinal femenino abreviado', () => {
    expect(ordinalConvocatoria(2)).toBe('2.ª')
    expect(ordinalConvocatoria(11)).toBe('11.ª')
  })
})

import { describe, expect, it } from 'vitest'
import type { AnalisisResponse } from '../../lib/analisis'
import { anchoGuardado, clampPanelWidth, interpretarAnalizar, pdfHashFicha, type RespuestaAnalizar } from './model'

const DATA = { contrato_id: 5, analisis: { resumen: 'r' } } as unknown as AnalisisResponse

function r(status: number, payload: RespuestaAnalizar['payload']): RespuestaAnalizar {
  return { status, ok: status >= 200 && status < 300, payload }
}

describe('interpretarAnalizar', () => {
  it('éxito entrega el análisis', () => {
    expect(interpretarAnalizar(r(200, DATA))).toEqual({ kind: 'datos', data: DATA })
  })

  it('502 o analisis_fallido muestran el aviso reintentable, aunque el cuerpo no sea JSON', () => {
    expect(interpretarAnalizar(r(502, { error: 'analisis_fallido' } as never))).toEqual({ kind: 'error502' })
    expect(interpretarAnalizar(r(502, null))).toEqual({ kind: 'error502' })
    expect(interpretarAnalizar(r(200, { error: 'analisis_fallido' } as never))).toEqual({ kind: 'error502' })
  })

  it('422 sin_tdr usa el mensaje del proxy o el predeterminado', () => {
    expect(interpretarAnalizar(r(422, { status: 'sin_tdr', mensaje: 'Sin TDR' } as never))).toEqual({ kind: 'sinTdr', mensaje: 'Sin TDR' })
    expect(interpretarAnalizar(r(422, { status: 'sin_tdr' } as never)))
      .toEqual({ kind: 'sinTdr', mensaje: 'este contrato no tiene TDR suficiente para analizar' })
  })

  it('otros errores: respuesta, mensaje o HTTP', () => {
    expect(interpretarAnalizar(r(429, { respuesta: 'Límite diario' } as never))).toEqual({ kind: 'error', mensaje: 'Límite diario' })
    expect(interpretarAnalizar(r(404, { error: 'Contrato no encontrado' } as never))).toEqual({ kind: 'error', mensaje: 'HTTP 404' })
    expect(interpretarAnalizar(r(500, null))).toEqual({ kind: 'error', mensaje: 'HTTP 500' })
    expect(interpretarAnalizar(r(200, { error: 'x', mensaje: 'detalle' } as never))).toEqual({ kind: 'error', mensaje: 'detalle' })
  })
})

describe('panel del asistente', () => {
  it('acota el ancho entre 320 y min(720, mitad de la ventana)', () => {
    expect(clampPanelWidth(100, 1920)).toBe(320)
    expect(clampPanelWidth(900, 1920)).toBe(720)
    expect(clampPanelWidth(600, 1000)).toBe(500)
    expect(clampPanelWidth(900)).toBe(720)
  })

  it('ancho guardado inválido vuelve al predeterminado', () => {
    expect(anchoGuardado(null)).toBe(380)
    expect(anchoGuardado('abc')).toBe(380)
    expect(anchoGuardado('-5')).toBe(380)
    expect(anchoGuardado('450', 1920)).toBe(450)
  })

  it('pdf_hash vacío usa na', () => {
    expect(pdfHashFicha({ pdf_hash: '  ' })).toBe('na')
    expect(pdfHashFicha({ pdf_hash: 'abc' })).toBe('abc')
  })
})

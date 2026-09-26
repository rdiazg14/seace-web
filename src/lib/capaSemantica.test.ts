import { describe, expect, it } from 'vitest'
import { fmtTasa, RUBRO_LABEL, tendenciaPct } from './capaSemantica'

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

import { describe, expect, it } from 'vitest'
import {
  COMPONENTE_LABEL,
  diasDesde,
  diasHasta,
  fmtDate,
  fmtNum,
  fmtTs,
  fmtUsd,
  isoDiasAtras,
  localIso,
  TIPO_LABEL,
  TRIGGER_STALE_MS,
} from './observabilidad'

describe('formatos de observabilidad', () => {
  it('fmtUsd: null → —, 0 → $0.00, <0.01 → <$0.01, resto recorta ceros', () => {
    expect(fmtUsd(null)).toBe('—')
    expect(fmtUsd(undefined)).toBe('—')
    expect(fmtUsd(0)).toBe('$0.00')
    expect(fmtUsd(0.005)).toBe('<$0.01')
    expect(fmtUsd(1.5)).toBe('$1.5')
    expect(fmtUsd(0.123)).toBe('$0.123')
    expect(fmtUsd(2.25)).toBe('$2.25')
  })

  it('fmtNum agrupa con separador de miles', () => {
    expect(fmtNum(1234567)).toMatch(/^1[.,]234[.,]567$/)
    expect(fmtNum(0)).toBe('0')
  })

  it('fmtTs: null → —, fecha válida → cadena, inválida → el texto original', () => {
    expect(fmtTs(null)).toBe('—')
    expect(fmtTs('no-es-fecha')).toBe('no-es-fecha')
    expect(fmtTs('2026-09-26T10:00:00Z')).not.toBe('—')
  })

  it('fmtDate muestra día/mes/año es-PE; inválida devuelve el texto', () => {
    expect(fmtDate('2026-09-26')).toMatch(/26.*2026/)
    expect(fmtDate('mal')).toBe('mal')
  })

  it('localIso e isoDiasAtras emiten YYYY-MM-DD', () => {
    expect(localIso(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(isoDiasAtras(3)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('diasDesde/diasHasta cuentan días calendario; inválido → 0', () => {
    expect(diasHasta('mal')).toBe(0)
    expect(diasDesde('mal')).toBe(0)
    const futuro = new Date()
    futuro.setDate(futuro.getDate() + 10)
    expect(diasHasta(localIso(futuro))).toBe(10)
  })

  it('etiquetas de componente y tipo + umbral de trigger', () => {
    expect(COMPONENTE_LABEL.chat).toBe('Chat RAG')
    expect(TIPO_LABEL.tabla_grafica).toBe('Tabla + gráfica')
    expect(TRIGGER_STALE_MS).toBe(36 * 60 * 60 * 1000)
  })
})

import { describe, expect, it } from 'vitest'
import {
  barrasPorTipo,
  donutPorEtapa,
  donutPorVersion,
  ETAPA_LABEL,
  fmtChars,
  fmtNum,
  fmtUsd,
  PAGE,
  TIPO_LABEL,
  totalPaginas,
  type ResumenData,
} from './model'

function mkResumen(over: Partial<ResumenData> = {}): ResumenData {
  return {
    contratos_con_eventos: 3,
    eventos_total: 10,
    ultimo_evento_at: null,
    primer_evento_at: null,
    chunks_pdf: 0,
    chunks_api: 0,
    chunks_total: 0,
    embebidos_v2: 0,
    cobertura_emb_pct: 0,
    costo_embed_usd: 0,
    tokens_embed_est: 0,
    por_etapa: [],
    por_chunk_version: [],
    por_tipo_extraccion: [],
    por_dia: [],
    ...over,
  }
}

describe('formatos de seguimiento', () => {
  it('fmtNum/fmtUsd/fmtChars cubren null, umbrales y sufijos', () => {
    expect(fmtNum(null)).toBe('—')
    expect(fmtNum(5)).toBe('5')
    expect(fmtUsd(null)).toBe('—')
    expect(fmtUsd(0)).toBe('$0.00')
    expect(fmtUsd(0.004)).toBe('<$0.01')
    expect(fmtUsd(1.5)).toBe('$1.5')
    expect(fmtChars(999)).toBe('999')
    expect(fmtChars(2_500)).toBe('2.5k')
    expect(fmtChars(3_200_000)).toBe('3.20M')
  })

  it('totalPaginas redondea por PAGE y nunca baja de 1', () => {
    expect(totalPaginas(null)).toBe(1)
    expect(totalPaginas({ total: 0, filas: [] })).toBe(1)
    expect(totalPaginas({ total: PAGE, filas: [] })).toBe(1)
    expect(totalPaginas({ total: PAGE + 1, filas: [] })).toBe(2)
  })
})

describe('derivaciones de distribución', () => {
  it('donutPorEtapa etiqueta, colorea, calcula % y filtra ceros', () => {
    const r = mkResumen({
      por_etapa: [
        { etapa: 'tdr_extraido', eventos: 3, contratos: 2, costo_usd: 0, chunks_pdf_sum: 0, chars_sum: 0 },
        { etapa: 'embedded', eventos: 1, contratos: 1, costo_usd: 0, chunks_pdf_sum: 0, chars_sum: 0 },
        { etapa: 'contenedor', eventos: 0, contratos: 0, costo_usd: 0, chunks_pdf_sum: 0, chars_sum: 0 },
        { etapa: 'etapa_rara', eventos: 1, contratos: 1, costo_usd: 0, chunks_pdf_sum: 0, chars_sum: 0 },
      ],
    })
    const d = donutPorEtapa(r)
    expect(d.map((x) => x.name)).toEqual(['TDR extraído', 'Embedded', 'etapa_rara'])
    expect(d[0].pct).toBe(60)
    expect(d[0].color).toBe('#0EA5E9')
    expect(d[2].color).toBe('#64748B')
  })

  it('donutPorVersion usa etiqueta de chunk_version y descarta ceros', () => {
    const r = mkResumen({
      por_chunk_version: [
        { chunk_version: '300_60', contratos: 9 },
        { chunk_version: '500_0', contratos: 1 },
      ],
    })
    const d = donutPorVersion(r)
    expect(d[0].name).toBe('300/60 · overlap')
    expect(d[0].pct).toBe(90)
    expect(d[1].name).toBe('500/0 · legacy')
  })

  it('donut y barras con resumen null devuelven vacío', () => {
    expect(donutPorEtapa(null)).toEqual([])
    expect(donutPorVersion(null)).toEqual([])
    expect(barrasPorTipo(null)).toEqual([])
  })

  it('barrasPorTipo ordena desc por contratos y etiqueta', () => {
    const r = mkResumen({
      por_tipo_extraccion: [
        { tipo_extraccion: 'ocr', contratos: 2 },
        { tipo_extraccion: 'pdf', contratos: 7 },
        { tipo_extraccion: 'rarito', contratos: 1 },
      ],
    })
    const b = barrasPorTipo(r)
    expect(b.map((x) => x.name)).toEqual(['PDF nativo', 'PDF + OCR', 'rarito'])
    expect(b[0].value).toBe(7)
  })

  it('etiquetas conocidas de etapa y tipo', () => {
    expect(ETAPA_LABEL.tdr_extraido).toBe('TDR extraído')
    expect(TIPO_LABEL.contenedor_rar).toBe('RAR')
  })
})

import { describe, expect, it } from 'vitest'
import {
  barrasComponente,
  COMPONENTE_LABEL,
  diasDesde,
  diasHasta,
  donutCosto,
  estadoTrigger,
  filasKv,
  fmtDate,
  fmtNum,
  fmtTs,
  fmtUsd,
  isoDiasAtras,
  localIso,
  SIN_PAGE,
  TIPO_LABEL,
  totalPaginasSinIntento,
  TRIGGER_STALE_MS,
  type AdminStats,
  type SinIntentoData,
  type UsoIaStats,
} from './model'

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

function statsCon(kv: Partial<AdminStats['kv']>): AdminStats {
  return {
    day: '2026-01-10',
    kv: {
      flash: 0,
      analyze: 0,
      cotizar: 0,
      cotizar_tipo: { texto: 0, tabla: 0, grafica: 0, tabla_grafica: 0 },
      chat_cache: { hit: 0, miss: 0 },
      pipeline_trigger_last_error: null,
      pipeline_trigger_last_ok: null,
      pipeline_trigger_token_expira: null,
      ...kv,
    },
  }
}

describe('estadoTrigger', () => {
  const ahora = Date.parse('2026-01-10T12:00:00Z')

  it('marca stale si el último OK tiene más de 36 h', () => {
    const stats = statsCon({
      pipeline_trigger_last_ok: { status: 200, body: '', timestamp: '2026-01-08T00:00:00Z' },
    })
    expect(estadoTrigger(stats, ahora).triggerStale).toBe(true)
    const reciente = statsCon({
      pipeline_trigger_last_ok: { status: 200, body: '', timestamp: '2026-01-10T00:00:00Z' },
    })
    expect(estadoTrigger(reciente, ahora).triggerStale).toBe(false)
  })

  it('triggerSinOk solo con stats cargados y sin last-ok', () => {
    expect(estadoTrigger(null, ahora).triggerSinOk).toBe(false)
    expect(estadoTrigger(statsCon({}), ahora).triggerSinOk).toBe(true)
  })

  it('token: <7 días alerta roja, <14 aviso ámbar, resto base', () => {
    const expira = (dias: number) => {
      const d = new Date(ahora + dias * 86_400_000)
      return { expira: localIso(d), leido_utc: '2026-01-10T00:00:00Z' }
    }
    expect(estadoTrigger(statsCon({ pipeline_trigger_token_expira: expira(3) }), ahora).tokenCls).toContain('red')
    expect(estadoTrigger(statsCon({ pipeline_trigger_token_expira: expira(10) }), ahora).tokenCls).toContain('amber')
    expect(estadoTrigger(statsCon({ pipeline_trigger_token_expira: expira(30) }), ahora).tokenCls).toContain('slate-200')
    expect(estadoTrigger(statsCon({}), ahora).diasToken).toBeNull()
  })
})

describe('derivaciones de consumo y cupos', () => {
  it('filasKv: vacío sin stats, 9 filas con claves del día', () => {
    expect(filasKv(null)).toEqual([])
    const rows = filasKv(statsCon({}))
    expect(rows).toHaveLength(9)
    expect(rows[0].clave).toBe('flash:2026-01-10')
    expect(rows.map((r) => r.clave)).toContain('chat_cache:miss:2026-01-10')
  })

  const uso: UsoIaStats = {
    desde: '2026-01-01',
    hasta: '2026-01-10',
    total: {
      llamadas: 3, tokens_prompt: 10, tokens_completion: 5, tokens_cached: 0,
      tokens_thoughts: 0, tokens_total: 15, costo_usd: 0.3, latencia_promedio_ms: 100,
    },
    por_dia: [],
    por_componente: [
      { componente: 'chat', llamadas: 2, tokens_prompt: 6, tokens_completion: 4, tokens_thoughts: 0, tokens_total: 10, costo_usd: 0.2 },
      { componente: 'raro', llamadas: 1, tokens_prompt: 4, tokens_completion: 1, tokens_thoughts: 0, tokens_total: 5, costo_usd: 0.1 },
      { componente: 'ocr', llamadas: 0, tokens_prompt: 0, tokens_completion: 0, tokens_thoughts: 0, tokens_total: 0, costo_usd: 0 },
    ],
    por_modelo: [],
    por_usuario: [],
    por_contrato: [],
    recientes: [],
  }

  it('barrasComponente etiqueta y separa prompt/completion', () => {
    const bars = barrasComponente(uso)
    expect(bars[0]).toEqual({ label: 'Chat RAG', Prompt: 6, Completion: 4 })
    expect(bars[1].label).toBe('raro')
    expect(barrasComponente(null)).toEqual([])
  })

  it('donutCosto: pct relativo al costo total y descarta costo 0', () => {
    const donut = donutCosto(uso)
    expect(donut).toHaveLength(2)
    expect(donut[0].name).toBe('Chat RAG')
    expect(donut[0].pct).toBeCloseTo(66.67, 1)
    expect(donut[1].color).toBe('#64748B')
    expect(donutCosto(null)).toEqual([])
  })

  it('totalPaginasSinIntento: 1 por defecto, ceil sobre SIN_PAGE', () => {
    expect(totalPaginasSinIntento(null)).toBe(1)
    const sin = { total: 0 } as SinIntentoData
    expect(totalPaginasSinIntento(sin)).toBe(1)
    expect(totalPaginasSinIntento({ ...sin, total: SIN_PAGE + 1 })).toBe(2)
  })
})

import { describe, expect, it } from 'vitest'
import type { EscenarioPayload } from '../../../lib/analisis'
import type { MensajeChat } from '../../../lib/chatSesiones'
import {
  botHistoryText,
  buildEscenaHistory,
  cambioRelevante,
  costoUsd,
  fmtCostoUsd,
  fmtUsd,
  graficaValida,
  hydrateEscenario,
  msgDesdeFila,
  parseClasificacion,
  payloadBot,
  readSseEvents,
  tablaValida,
  usoTokensTotal,
  type CotizarSseEvent,
  type EscenaMsg,
} from './model'

function sseResponse(chunks: string[]): Response {
  const enc = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      for (const ch of chunks) c.enqueue(enc.encode(ch))
      c.close()
    },
  })
  return new Response(body)
}

function escenario(over: Partial<EscenarioPayload> = {}): EscenarioPayload {
  return {
    tipo_respuesta: 'texto',
    escenario: 'El techo es 8 UIT',
    supuestos_aplicados: [],
    cambio_vs_analisis: '',
    sigue_sin_saberse: [],
    valor_estimado_soles: null,
    costo_estimado_soles: null,
    margen_estimado_soles: null,
    nota: '',
    ...over,
  }
}

describe('readSseEvents', () => {
  it('une bloques partidos, ignora líneas sin data, [DONE] y JSON inválido', async () => {
    const events: CotizarSseEvent[] = []
    await readSseEvents(sseResponse([
      'data: {"type":"phase","ph',
      'ase":"contexto"}\n\n: comentario\n\ndata: [DONE]\n\ndata: {rot\n\n',
      'event: x\ndata: {"type":"text","token":"Ho"}\n\n',
    ]), (e) => events.push(e))
    expect(events).toEqual([{ type: 'phase', phase: 'contexto' }, { type: 'text', token: 'Ho' }])
  })

  it('procesa el último bloque aunque no termine en línea en blanco', async () => {
    const events: CotizarSseEvent[] = []
    await readSseEvents(sseResponse(['data: {"type":"done"}']), (e) => events.push(e))
    expect(events).toEqual([{ type: 'done' }])
  })

  it('los errores del manejador no interrumpen la lectura', async () => {
    const seen: string[] = []
    await readSseEvents(sseResponse(['data: {"type":"a"}\n\ndata: {"type":"b"}\n\n']), (e) => {
      seen.push(e.type!)
      throw new Error('boom')
    })
    expect(seen).toEqual(['a', 'b'])
  })

  it('sin cuerpo lanza sin stream', async () => {
    await expect(readSseEvents(new Response(null), () => {})).rejects.toThrow('sin stream')
  })
})

describe('historial del asistente', () => {
  it('excluye errores, límites, avisos y bots vacíos; recorta a 500 caracteres y 8 turnos', () => {
    const msgs: EscenaMsg[] = [
      { role: 'user', text: 'x'.repeat(600) },
      { role: 'bot', text: '   ' },
      { role: 'bot', text: 'error', error: true },
      { role: 'bot', text: 'cupo', limit: true },
      { role: 'bot', text: 'aviso', aviso: true },
      ...Array.from({ length: 9 }, (_, i) => ({ role: 'user' as const, text: `q${i}` })),
    ]
    const h = buildEscenaHistory(msgs)
    expect(h).toHaveLength(8)
    expect(h[0]).toEqual({ role: 'user', text: 'q1' })
    expect(buildEscenaHistory(msgs.slice(0, 1))[0].text).toHaveLength(500)
  })

  it('texto de historial del bot incluye supuestos solo si hay cifras', () => {
    expect(botHistoryText(escenario())).toBe('[texto] El techo es 8 UIT')
    expect(botHistoryText(escenario({ tipo_respuesta: 'tabla', supuestos_aplicados: ['a', 'b'] })))
      .toBe('[tabla] El techo es 8 UIT. Asumiendo: a; b')
  })
})

describe('persistencia de mensajes del asistente', () => {
  const fila = (over: Partial<MensajeChat>): MensajeChat => ({
    id: 1, rol: 'bot', texto: 't', refs: null, tokens_prompt: 0, tokens_completion: 0, error: false, limit_flag: false, ...over,
  })

  it('payloadBot serializa el estado rico y es null para el usuario', () => {
    expect(payloadBot({ role: 'user', text: 'q' })).toBeNull()
    expect(payloadBot({ role: 'bot', text: 't', model: 'm', requestId: 'r' })).toEqual({
      escenario: null, clasificacion: null, thought: null, model: 'm', request_id: 'r', usage: null, meta: null, web_sources: null,
    })
  })

  it('msgDesdeFila reconstruye el escenario y marca progreso completo', () => {
    const m = msgDesdeFila(fila({
      payload: {
        escenario: { ...escenario(), tabla: { titulo: 't', columnas: ['a'], filas: [{ celdas: [1, null] }] } },
        clasificacion: { necesita_internet: true },
        thought: 'pensé',
        model: 'gemini-3.1-flash-lite',
        request_id: 'req',
        usage: { prompt: 1, completion: 2 },
        web_sources: [{ uri: 'u', title: 't' }],
      },
    }))
    expect(m).toMatchObject({
      role: 'bot', progress: true, phase: 'redactar', streamText: 'El techo es 8 UIT', thought: 'pensé',
      model: 'gemini-3.1-flash-lite', requestId: 'req', clasificacion: { necesita_internet: true },
    })
    expect(m.escenario?.tabla?.filas).toEqual([['1', '']])
  })

  it('una fila con error conserva el flag y no simula progreso', () => {
    const m = msgDesdeFila(fila({ error: true, payload: { escenario: escenario() } }))
    expect(m.error).toBe(true)
    expect(m.progress).toBeUndefined()
    expect(msgDesdeFila(fila({ rol: 'user', texto: 'hola' }))).toMatchObject({ role: 'user', text: 'hola' })
  })
})

describe('costos y formatos', () => {
  it('costo usa precio del modelo, cuenta razonamiento como salida y cae a flash-lite', () => {
    const u = { prompt: 1_000_000, completion: 0, thoughts: 1_000_000 }
    expect(costoUsd(u, 'gemini-3.7-flash')).toBeCloseTo(0.75 + 3.75)
    expect(costoUsd(u, 'desconocido')).toBeCloseTo(0.25 + 1.5)
    expect(costoUsd(null)).toBe(0)
    expect(usoTokensTotal({ prompt: 1, completion: 2, thoughts: 3 })).toBe(6)
  })

  it('formatea importes pequeños, cero y desconocidos', () => {
    expect(fmtCostoUsd(0)).toBe('$0.00')
    expect(fmtCostoUsd(0.004)).toBe('<$0.01')
    expect(fmtCostoUsd(0.1234)).toBe('$0.123')
    expect(fmtUsd(null)).toBe('—')
    expect(fmtUsd(-1.5)).toBe('-$1.50')
  })

  it('validaciones de tabla, gráfica, clasificación y cambio', () => {
    expect(tablaValida({ titulo: '', columnas: ['a'], filas: [['1']] })).toBe(true)
    expect(tablaValida({ titulo: '', columnas: [], filas: [['1']] })).toBe(false)
    expect(graficaValida({ tipo_grafica: 'barras', titulo: '', unidad: '', datos: [{ label: 'a', valor: 1 }] })).toBe(true)
    expect(graficaValida(null)).toBe(false)
    expect(parseClasificacion({ necesita_internet: 'si' })).toEqual({ necesita_internet: false })
    expect(parseClasificacion(null)).toBeUndefined()
    expect(cambioRelevante(' Ninguno ')).toBe('')
    expect(cambioRelevante('sube margen')).toBe('sube margen')
    expect(hydrateEscenario(null)).toBeNull()
  })
})

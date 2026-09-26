import { describe, expect, it } from 'vitest'
import {
  aplicarEventoChat,
  buildChatHistory,
  composeRagPrefill,
  hace,
  mensajeConexionFallida,
  mensajeDesdeJson,
  mensajeDesdeStream,
  mensajeHttpFallido,
  STREAM_INICIAL,
  usoContexto,
  type ChatMsg,
  type EventoChat,
  type StreamChat,
} from './model'

const REF = { id: 11, nro: 'CM-11', entidad: 'MINSA', estado: 'Vigente', url: 'u', fuente: 'pdf' as const }

describe('historial enviado al proxy', () => {
  it('omite errores, límites y bots vacíos; recorta a 500 y conserva los últimos 8', () => {
    const msgs: ChatMsg[] = [
      { role: 'user', text: 'x'.repeat(700) },
      { role: 'bot', text: '' },
      { role: 'bot', text: 'fallo', error: true },
      { role: 'bot', text: 'cupo', limit: true },
    ]
    expect(buildChatHistory(msgs)).toEqual([{ role: 'user', text: 'x'.repeat(500) }])
    const muchos = Array.from({ length: 10 }, (_, i) => ({ role: 'user' as const, text: `q${i}` }))
    expect(buildChatHistory(muchos).map(t => t.text)).toEqual(['q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9'])
  })
})

describe('respuestas no exitosas', () => {
  it('429/503 y códigos de cupo son límite; el texto del Worker tiene prioridad', () => {
    expect(mensajeHttpFallido(429, { respuesta: 'Espera' }, 'q')).toEqual({ role: 'bot', text: 'Espera', error: false, limit: true, query: 'q' })
    expect(mensajeHttpFallido(200, { error: 'daily_limited' }, 'q')).toMatchObject({
      limit: true, text: 'Llegaste al límite diario de consultas desde esta red. Intenta mañana.',
    })
    expect(mensajeHttpFallido(503, {}, 'q').text).toBe('Hay alta demanda en el asistente. Intenta más tarde.')
  })

  it('502 y otros son errores reintentables', () => {
    expect(mensajeHttpFallido(502, {}, 'q')).toMatchObject({
      error: true, limit: false, text: 'El servicio no respondió correctamente. Podés reintentar la misma pregunta.',
    })
    expect(mensajeHttpFallido(401, { error: 'unauthorized' }, 'q').text).toBe('No pude consultar la IA ahora. Prueba de nuevo o usa el buscador.')
  })

  it('cancelación y fallo de red', () => {
    expect(mensajeConexionFallida(true, 'q').text).toBe('La conexión se interrumpió. Puedes reintentar la misma pregunta.')
    expect(mensajeConexionFallida(false, 'q')).toMatchObject({ error: true, query: 'q' })
  })
})

describe('eventos SSE del chat', () => {
  function correr(eventos: EventoChat[]) {
    let s: StreamChat = STREAM_INICIAL
    const patches: Partial<ChatMsg>[] = []
    for (const ev of eventos) {
      const r = aplicarEventoChat(s, ev, 'q')
      if (r.error) return { s, patches, error: r.error }
      s = r.s
      if (r.patch) patches.push(r.patch)
    }
    return { s, patches, error: null }
  }

  it('etapas, tokens acumulados y cierre con citas y uso', () => {
    const r = correr([
      { stage: 'searching', message: 'Buscando en TDR...' },
      { stage: 'found', chunks: 3 },
      { stage: 'streaming', token: 'Hay ' },
      { stage: 'streaming', token: '' },
      { stage: 'streaming', token: '2' },
      { stage: 'done', contratos_referenciados: [REF], usage: { prompt: 5, completion: 1 } },
    ])
    expect(r.patches).toEqual([
      { stage: 'Buscando en TDR...', query: 'q' },
      { stage: 'Encontré 3 fragmentos relevantes', query: 'q' },
      { text: 'Hay ', stage: 'Redactando la respuesta…', query: 'q' },
      { text: 'Hay 2', stage: 'Redactando la respuesta…', query: 'q' },
    ])
    expect(r.s).toEqual({ text: 'Hay 2', refs: [REF], web: [], usage: { prompt: 5, completion: 1 } })
    expect(STREAM_INICIAL.text).toBe('')
  })

  it('found sin conteo y error del proxy', () => {
    expect(correr([{ stage: 'found' }]).patches[0].stage).toBe('Encontré fragmentos relevantes')
    expect(correr([{ stage: 'error', message: 'gemini embed HTTP 500' }]).error).toBe('gemini embed HTTP 500')
    expect(correr([{ stage: 'error' }]).error).toBe('error SSE')
  })

  it('mensaje final: texto vacío se reemplaza y conserva tokens', () => {
    const m = mensajeDesdeStream({ ...STREAM_INICIAL, usage: { prompt: 3, completion: 4 } }, [], 'q')
    expect(m).toMatchObject({ text: 'No pude generar una respuesta.', tokens_prompt: 3, tokens_completion: 4 })
  })
})

describe('respuesta JSON', () => {
  it('usa respuesta o response y marca error si el proxy lo reporta con 200', () => {
    expect(mensajeDesdeJson({ response: 'ok', usage: { prompt: 1, completion: 2 } }, [], 'q'))
      .toMatchObject({ text: 'ok', error: false, tokens_prompt: 1, tokens_completion: 2, refs: [], webSources: [] })
    expect(mensajeDesdeJson({ error: 'gemini', respuesta: 'No pude' }, [], 'q')).toMatchObject({ error: true, text: 'No pude' })
  })
})

describe('utilidades de presentación', () => {
  it('prefill con contexto del contrato', () => {
    expect(composeRagPrefill('¿plazo?', 'CM-1', 'Portal', 'desarrollo')).toBe('[Contexto: CM-1 — Portal · desarrollo] ¿plazo?')
    expect(composeRagPrefill('¿plazo?', '', '', null)).toBe('¿plazo?')
  })

  it('antigüedad relativa', () => {
    const now = Date.parse('2026-09-26T12:00:00Z')
    expect(hace('2026-09-26T11:59:40Z', now)).toBe('ahora')
    expect(hace('2026-09-26T11:15:00Z', now)).toBe('hace 45 min')
    expect(hace('2026-09-26T07:00:00Z', now)).toBe('hace 5 h')
    expect(hace('2026-09-23T12:00:00Z', now)).toBe('hace 3 d')
    expect(hace('no-fecha', now)).toBe('')
  })

  it('uso de contexto toma el último prompt registrado', () => {
    expect(usoContexto([{ role: 'bot', text: 'a', tokens_prompt: 250_000 }, { role: 'user', text: 'b' }]))
      .toEqual({ lastPrompt: 250_000, pct: 25 })
    expect(usoContexto([])).toEqual({ lastPrompt: 0, pct: 0 })
  })
})

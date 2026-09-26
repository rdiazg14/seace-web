import { describe, expect, it } from 'vitest'
import type { EscenarioPayload } from '../../../lib/analisis'
import {
  aplicarEventoCotizar,
  falloBot,
  interpretarCotizarJson,
  mensajeErrorStream,
  revelarBuffer,
  tokensSesion,
  type CotizarSseEvent,
  type EscenaMsg,
} from './model'

const ESC: EscenarioPayload = {
  tipo_respuesta: 'texto',
  escenario: 'El techo es 8 UIT',
  supuestos_aplicados: [],
  cambio_vs_analisis: '',
  sigue_sin_saberse: [],
  valor_estimado_soles: null,
  costo_estimado_soles: null,
  margen_estimado_soles: null,
  nota: '',
}

const INICIAL: EscenaMsg = { id: 'b', role: 'bot', text: '', streaming: true, progress: true, phase: 'clasificar', streamText: '' }

describe('interpretarCotizarJson', () => {
  it('502 explica la capa y deja reintentar', () => {
    expect(interpretarCotizarJson(502, false, { layer: 'gemini' }, 'q')).toEqual({
      kind: 'fallo',
      text: 'El servicio de IA (Gemini) no respondió correctamente. Podés reintentar la misma pregunta.',
      extra: { type: 'error', error: true, query: 'q' },
    })
    expect(interpretarCotizarJson(502, false, { layer: 'supabase' }, 'q').kind === 'fallo'
      && interpretarCotizarJson(502, false, { layer: 'supabase' }, 'q')).toMatchObject({ text: expect.stringContaining('base de datos') })
    expect(interpretarCotizarJson(502, false, {}, 'q')).toMatchObject({ text: 'El servicio no respondió correctamente. Podés reintentar la misma pregunta.' })
  })

  it('409 sin_analisis es aviso; 429/503 y códigos de cupo son límite', () => {
    expect(interpretarCotizarJson(409, false, { status: 'sin_analisis', mensaje: 'Analizá primero' }, 'q'))
      .toEqual({ kind: 'fallo', text: 'Analizá primero', extra: { aviso: true } })
    expect(interpretarCotizarJson(503, false, {}, 'q')).toEqual({
      kind: 'fallo', text: 'Hay alta demanda en el asistente. Intenta más tarde.', extra: { limit: true },
    })
    expect(interpretarCotizarJson(429, false, { respuesta: 'Espera' }, 'q')).toMatchObject({ text: 'Espera', extra: { limit: true } })
    expect(interpretarCotizarJson(200, true, { error: 'daily_limited' }, 'q')).toMatchObject({
      text: 'Has hecho demasiadas consultas. Espera un minuto e intenta de nuevo.',
    })
  })

  it('otros fallos o respuesta sin escenario se convierten en excepción', () => {
    expect(interpretarCotizarJson(400, false, { error: 'query vacío' }, 'q')).toEqual({ kind: 'excepcion', message: 'query vacío' })
    expect(interpretarCotizarJson(200, true, {}, 'q')).toEqual({ kind: 'excepcion', message: 'HTTP 200' })
  })

  it('éxito normaliza filas de tabla', () => {
    const r = interpretarCotizarJson(200, true, {
      escenario: { ...ESC, tabla: { titulo: 't', columnas: ['a'], filas: [{ celdas: [1] }] as unknown as string[][] } },
    }, 'q')
    expect(r.kind).toBe('ok')
    if (r.kind === 'ok') expect(r.escenario.tabla?.filas).toEqual([['1']])
  })
})

describe('aplicarEventoCotizar', () => {
  function correr(eventos: CotizarSseEvent[]) {
    let msg = INICIAL
    const efectos = eventos.map(ev => {
      const e = aplicarEventoCotizar(msg, ev)
      msg = e.msg
      return e
    })
    return { msg, efectos }
  }

  it('fases, razonamiento y texto con revelado diferido del primer bloque', () => {
    const { msg, efectos } = correr([
      { type: 'phase', phase: 'redactar' },
      { type: 'phase', phase: 'otra' },
      { type: 'thought', token: 'Pien' },
      { type: 'thought', token: 'so' },
      { type: 'thought_done' },
      { type: 'text', token: 'El techo ' },
      { type: 'text', token: 'es' },
    ])
    expect(msg.phase).toBe('clasificar')
    expect(msg.thought).toBe('Pienso')
    expect(msg.thoughtStreaming).toBe(false)
    expect(msg.streamText).toBe('')
    expect(msg.streamBuffer).toBe('El techo es')
    expect(efectos.map(e => e.programarRevelado)).toEqual([false, false, false, false, false, true, true])
    const revelado = revelarBuffer(msg)
    expect(revelado.streamText).toBe('El techo es')
    expect(revelado.streamBuffer).toBeUndefined()
    expect(aplicarEventoCotizar(revelado, { type: 'text', token: ' 8' }).msg.streamText).toBe('El techo es 8')
  })

  it('data cierra el mensaje con escenario, metadatos y texto de historial', () => {
    const ev: CotizarSseEvent = {
      type: 'data', escenario: ESC, clasificacion: { necesita_internet: true }, usage: { prompt: 1, completion: 2 },
      thought: 'T', model: 'gemini-3.1-flash-lite', request_id: 'r', models: ['a'], saldo_usd: 5,
    }
    const e = aplicarEventoCotizar({ ...INICIAL, streamBuffer: 'El' }, ev)
    expect(e.datos).toBe(ev)
    expect(e.msg).toMatchObject({
      streaming: false, progress: true, text: '[texto] El techo es 8 UIT', escenario: ESC, streamText: 'El techo es 8 UIT',
      streamBuffer: undefined, clasificacion: { necesita_internet: true }, model: 'gemini-3.1-flash-lite', requestId: 'r', webSources: [],
    })
  })

  it('error del stream oculta detalles del proveedor', () => {
    expect(aplicarEventoCotizar(INICIAL, { type: 'error', message: 'gemini HTTP 400 [modelo=x]' }).error)
      .toBe('El servicio no respondió correctamente. Podés reintentar la misma pregunta.')
    expect(mensajeErrorStream('otra cosa')).toBe('otra cosa')
    expect(mensajeErrorStream()).toBe('No pude recalcular el escenario')
    expect(aplicarEventoCotizar(INICIAL, { type: 'desconocido' }).msg).toBe(INICIAL)
  })
})

describe('fallos y tokens de sesión', () => {
  it('falloBot limpia el streaming y conserva el id', () => {
    expect(falloBot({ ...INICIAL, streamText: 'x', escenario: ESC }, 'Límite', { limit: true })).toEqual({
      id: 'b', role: 'bot', text: 'Límite', streaming: false, progress: false, phase: 'clasificar',
      streamText: '', streamBuffer: undefined, escenario: null, limit: true,
    })
  })

  it('suma tokens de mensajes previos del bot y de la respuesta nueva', () => {
    const previos: EscenaMsg[] = [
      { role: 'user', text: 'q' },
      { role: 'bot', text: 'a', usage: { prompt: 10, completion: 5 } },
      { role: 'bot', text: 'b' },
    ]
    expect(tokensSesion(previos, { role: 'bot', text: 'c', usage: { prompt: 1, completion: 2 } })).toEqual({ prompt: 11, completion: 7 })
  })
})

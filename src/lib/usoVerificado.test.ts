/** Uso verificado: lectura de `uso_ia` bajo RLS, agregación por request y
 *  degradación a "declarado" cuando el servidor no tiene fila o la lectura falla. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { agruparUso, cargarUsoVerificado, requestIdValido } from './usoVerificado'
import { aplicarUsoVerificado, ErrorChat, mensajeConexionFallida, mensajeDesdeJson, mensajeDesdeStream, mensajeHttpFallido, STREAM_INICIAL, aplicarEventoChat, totalesDe, type ChatMsg } from '../features/chat/model'
import { aplicarUsoVerificadoEscena, type EscenaMsg } from '../features/analisis/asistente/model'

const m = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('./supabase', () => ({ supabase: { from: m.from } }))

function query(res: { data: unknown; error: unknown }) {
  const q: Record<string, ReturnType<typeof vi.fn>> & { then?: unknown } = {}
  for (const key of ['select', 'in', 'abortSignal']) q[key] = vi.fn(() => q)
  q.then = (ok: (v: unknown) => unknown) => Promise.resolve(res).then(ok)
  return q
}

const fila = (over: Record<string, unknown> = {}) => ({
  request_id: 'req-00000001',
  modelo: 'qwen3.7-flash',
  tokens_prompt: 100,
  tokens_completion: 20,
  tokens_thoughts: 0,
  tokens_cached: 0,
  costo_usd: '0.000150',
  latencia_ms: 900,
  resultado: 'ok',
  ...over,
})

beforeEach(() => vi.resetAllMocks())

describe('cargarUsoVerificado', () => {
  it('consulta uso_ia solo por ids válidos y solo filas de generación', async () => {
    const q = query({ data: [fila()], error: null })
    m.from.mockReturnValue(q)
    const uso = await cargarUsoVerificado(['req-00000001', 'req-00000001', undefined, '', "x' or 1=1", 42])
    expect(m.from).toHaveBeenCalledWith('uso_ia')
    expect(q.in).toHaveBeenCalledWith('request_id', ['req-00000001'])
    expect(q.in).toHaveBeenCalledWith('componente', ['chat', 'cotizar'])
    expect(uso.get('req-00000001')).toEqual({
      prompt: 100, completion: 20, thoughts: 0, cached: 0,
      costoUsd: 0.00015, modelo: 'qwen3.7-flash', latenciaMs: 900, resultado: 'ok',
    })
  })

  it('sin ids válidos no toca la red', async () => {
    expect((await cargarUsoVerificado([undefined, null, 'corto'])).size).toBe(0)
    expect(m.from).not.toHaveBeenCalled()
  })

  it('un fallo de lectura no lanza: el request queda sin verificar', async () => {
    m.from.mockReturnValue(query({ data: null, error: { message: 'permission denied' } }))
    const errores = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect((await cargarUsoVerificado(['req-00000001'])).size).toBe(0)
    errores.mockRestore()
  })

  it('más de cien requests se piden por lotes', async () => {
    m.from.mockImplementation(() => query({ data: [], error: null }))
    await cargarUsoVerificado(Array.from({ length: 205 }, (_, i) => `req-${String(i).padStart(8, '0')}`))
    expect(m.from).toHaveBeenCalledTimes(3)
  })
})

describe('agruparUso', () => {
  it('suma las generaciones de un mismo request', () => {
    const uso = agruparUso([fila(), fila({ tokens_prompt: 50, tokens_completion: 5, costo_usd: 0.0001, latencia_ms: 100 })])
    expect(uso.get('req-00000001')).toMatchObject({ prompt: 150, completion: 25, latenciaMs: 1000 })
    expect(uso.get('req-00000001')!.costoUsd).toBeCloseTo(0.00025, 10)
  })

  it('un costo desconocido vuelve desconocido el total, no cero ni suma parcial', () => {
    expect(agruparUso([fila(), fila({ costo_usd: null })]).get('req-00000001')!.costoUsd).toBeNull()
    expect(agruparUso([fila({ costo_usd: null })]).get('req-00000001')!.costoUsd).toBeNull()
  })

  it('ignora filas sin request_id', () => {
    expect(agruparUso([fila({ request_id: null })]).size).toBe(0)
  })
})

describe('requestIdValido', () => {
  it('acepta uuid e ids del proxy; rechaza texto libre', () => {
    expect(requestIdValido('5f0c2f6e-3a52-4d0b-9c0e-0a2d3a4b5c6d')).toBe(true)
    expect(requestIdValido('a b')).toBe(false)
    expect(requestIdValido('<script>')).toBe(false)
    expect(requestIdValido(null)).toBe(false)
  })
})

describe('chat general: declarado frente a verificado', () => {
  const guardados: ChatMsg[] = [
    { role: 'user', text: 'hola' },
    { role: 'bot', text: 'a', tokens_prompt: 999999, tokens_completion: 999999, requestId: 'req-00000001' },
    { role: 'bot', text: 'b', tokens_prompt: 10, tokens_completion: 2 },
  ]
  const uso = new Map([['req-00000001', { prompt: 100, completion: 20 }]])

  it('los tokens guardados por el navegador no prevalecen sobre uso_ia', () => {
    const out = aplicarUsoVerificado(guardados, uso)
    expect(out[1]).toMatchObject({ tokens_prompt: 100, tokens_completion: 20, verificado: true })
    expect(out[2]).toMatchObject({ tokens_prompt: 10, tokens_completion: 2, verificado: false })
    expect(out[0]).toBe(guardados[0])
  })

  it('un request_id ajeno o inexistente no trae cifras: queda declarado', () => {
    const out = aplicarUsoVerificado(guardados, new Map())
    expect(out[1]).toMatchObject({ tokens_prompt: 999999, verificado: false })
  })

  it('el total solo es verificado si todos los mensajes con tokens lo son', () => {
    expect(totalesDe(aplicarUsoVerificado(guardados, uso))).toEqual({ prompt: 110, completion: 22, verificado: false })
    expect(totalesDe(aplicarUsoVerificado(guardados.slice(0, 2), uso))).toEqual({ prompt: 100, completion: 20, verificado: true })
    expect(totalesDe([])).toEqual({ prompt: 0, completion: 0, verificado: true })
  })

  it('la respuesta en vivo conserva el request_id del servidor (JSON y SSE)', () => {
    const json = mensajeDesdeJson({ respuesta: 'ok', usage: { prompt: 5, completion: 1 }, request_id: 'req-00000001' }, [], 'q')
    expect(json).toMatchObject({ requestId: 'req-00000001', verificado: true })
    const { s } = aplicarEventoChat(STREAM_INICIAL, { stage: 'done', usage: { prompt: 5, completion: 1 }, request_id: 'req-00000002' }, 'q')
    expect(mensajeDesdeStream(s, [], 'q')).toMatchObject({ requestId: 'req-00000002', verificado: true })
  })

  it('GW-009: los errores conservan el request_id del proxy para soporte', () => {
    const sse = aplicarEventoChat(STREAM_INICIAL, { stage: 'error', message: 'fallo', request_id: 'req-00000003' }, 'q')
    expect([sse.error, sse.requestId]).toEqual(['fallo', 'req-00000003'])
    expect(mensajeConexionFallida(false, 'q', sse.requestId)).toMatchObject({ error: true, requestId: 'req-00000003' })
    expect(mensajeHttpFallido(503, { error: 'plazo_agotado', request_id: 'req-00000004' }, 'q').requestId).toBe('req-00000004')
    expect(mensajeHttpFallido(500, { request_id: 'texto libre' }, 'q').requestId).toBeUndefined()
    expect(new ErrorChat('x', 'req-00000005').requestId).toBe('req-00000005')
  })

  it('un proxy antiguo sin request_id deja la respuesta como no verificada', () => {
    expect(mensajeDesdeJson({ respuesta: 'ok', usage: { prompt: 5, completion: 1 } }, [], 'q').verificado).toBe(false)
    expect(mensajeDesdeJson({ respuesta: 'ok', request_id: 'texto libre con espacios' }, [], 'q').requestId).toBeUndefined()
  })
})

describe('asistente por contrato: declarado frente a verificado', () => {
  const base: EscenaMsg = { id: '1', role: 'bot', text: 'x', requestId: 'req-00000001', usage: { prompt: 9, completion: 9 }, costoUsd: 0, model: 'declarado' }

  it('uso, costo y modelo del servidor reemplazan el payload guardado', () => {
    const uso = agruparUso([fila({ tokens_thoughts: 7 })])
    const [out] = aplicarUsoVerificadoEscena([base], uso)
    expect(out).toMatchObject({
      usage: { prompt: 100, completion: 20, thoughts: 7, cached: 0 },
      costoUsd: 0.00015,
      model: 'qwen3.7-flash',
      verificado: true,
    })
  })

  it('sin fila del servidor conserva la copia y la marca como declarada', () => {
    const [out] = aplicarUsoVerificadoEscena([base], new Map())
    expect(out).toMatchObject({ usage: { prompt: 9, completion: 9 }, costoUsd: 0, verificado: false })
  })

  it('mensajes sin cifras o del usuario no reciben marca', () => {
    const user: EscenaMsg = { id: '2', role: 'user', text: 'hola' }
    const vacio: EscenaMsg = { id: '3', role: 'bot', text: 'error', error: true }
    const out = aplicarUsoVerificadoEscena([user, vacio], new Map())
    expect(out[0]).toBe(user)
    expect(out[1]).toBe(vacio)
  })
})

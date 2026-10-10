/** Listado de conversaciones: el total verificado viene de la vista del servidor
 *  y su ausencia o fallo nunca rompe la lista ni se presenta como verificado. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listarSesiones, listarSesionesContrato, tokensSesion, type SesionChat } from './chatSesiones'

const m = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('./supabase', () => ({ supabase: { from: m.from } }))

function query(res: { data: unknown; error: unknown }) {
  const q: Record<string, ReturnType<typeof vi.fn>> & { then?: unknown } = {}
  for (const key of ['select', 'eq', 'is', 'in', 'order']) q[key] = vi.fn(() => q)
  q.then = (ok: (v: unknown) => unknown) => Promise.resolve(res).then(ok)
  return q
}

const sesion = (over: Partial<SesionChat> = {}): SesionChat => ({
  id: 's1', titulo: 't', tokens_prompt: 900, tokens_completion: 100, n_mensajes: 2, updated_at: '2026-10-10T00:00:00Z', ...over,
})
const vista = (over: Record<string, unknown> = {}) => ({
  sesion_id: 's1', tokens_prompt: 100, tokens_completion: 20, tokens_thoughts: 0, requests_verificados: 1, mensajes_solo_declarados: 0, ...over,
})

function tablas(sesiones: unknown[], uso: { data: unknown; error: unknown }) {
  const qs: Record<string, ReturnType<typeof query>> = {
    chat_sesiones: query({ data: sesiones, error: null }),
    v_chat_sesiones_uso: query(uso),
  }
  m.from.mockImplementation((t: string) => qs[t])
  return qs
}

beforeEach(() => vi.resetAllMocks())

describe('listarSesiones', () => {
  it('adjunta el uso verificado pidiendo solo las sesiones listadas', async () => {
    const qs = tablas([sesion(), sesion({ id: 's2' })], { data: [vista()], error: null })
    const out = await listarSesiones('user-a')
    expect(qs.v_chat_sesiones_uso.in).toHaveBeenCalledWith('sesion_id', ['s1', 's2'])
    expect(out[0].uso).toEqual({ tokens: 120, requests_verificados: 1, mensajes_solo_declarados: 0 })
    expect(out[1].uso).toBeUndefined()
  })

  it('vista inexistente o con error: la lista se devuelve igual, sin uso', async () => {
    tablas([sesion()], { data: null, error: { code: 'PGRST205', message: 'not found' } })
    const out = await listarSesiones('user-a')
    expect(out).toHaveLength(1)
    expect(out[0].uso).toBeUndefined()
  })

  it('sin sesiones no consulta la vista', async () => {
    tablas([], { data: [], error: null })
    await listarSesiones('user-a')
    expect(m.from).toHaveBeenCalledTimes(1)
  })

  it('valores inesperados de la vista se tratan como cero, no como cifras', async () => {
    tablas([sesion()], { data: [vista({ tokens_prompt: 'x', tokens_completion: -5, requests_verificados: null })], error: null })
    expect((await listarSesiones('user-a'))[0].uso).toEqual({ tokens: 0, requests_verificados: 0, mensajes_solo_declarados: 0 })
  })

  it('las sesiones por contrato también llevan el uso verificado', async () => {
    tablas([sesion({ contrato_id: 7 })], { data: [vista()], error: null })
    expect((await listarSesionesContrato('user-a', 7))[0].uso?.tokens).toBe(120)
  })

  it('un error al listar sesiones se sigue propagando', async () => {
    m.from.mockReturnValue(query({ data: null, error: { message: 'boom' } }))
    await expect(listarSesiones('user-a')).rejects.toMatchObject({ message: 'boom' })
  })
})

describe('tokensSesion', () => {
  it('verificado: todo con registro del servidor', () => {
    expect(tokensSesion(sesion({ uso: { tokens: 120, requests_verificados: 1, mensajes_solo_declarados: 0 } }))).toEqual({ tokens: 120, estimado: false })
  })

  it('estimado: sin vista, con respuestas solo declaradas o sin ningún request verificado', () => {
    expect(tokensSesion(sesion())).toEqual({ tokens: 1000, estimado: true })
    expect(tokensSesion(sesion({ uso: { tokens: 120, requests_verificados: 1, mensajes_solo_declarados: 1 } }))).toEqual({ tokens: 1000, estimado: true })
    expect(tokensSesion(sesion({ uso: { tokens: 0, requests_verificados: 0, mensajes_solo_declarados: 0 } }))).toEqual({ tokens: 1000, estimado: true })
  })

  it('conversación sin consumo declarado ni registrado: cero verificado', () => {
    const vacia = sesion({ tokens_prompt: 0, tokens_completion: 0, uso: { tokens: 0, requests_verificados: 0, mensajes_solo_declarados: 0 } })
    expect(tokensSesion(vacia)).toEqual({ tokens: 0, estimado: false })
  })
})

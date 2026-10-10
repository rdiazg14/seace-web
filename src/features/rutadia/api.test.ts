/** API de Diario contra un doble del builder PostgREST: paginación, señal de
 *  cancelación propagada y errores que ya no se disfrazan de ausencia. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cargarEstadoPipeline, cargarOcultos, fetchAnalisisScore, fetchUniverso } from './api'

const m = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('../../lib/supabase', () => ({ supabase: { from: m.from } }))

type Res = { data: unknown; error: unknown }

function query(res: Res) {
  const q: Record<string, ReturnType<typeof vi.fn>> & { then?: unknown } = {}
  for (const key of ['select', 'in', 'or', 'order', 'range', 'limit', 'eq', 'abortSignal']) q[key] = vi.fn(() => q)
  q.maybeSingle = vi.fn(async () => res)
  q.then = (ok: (v: Res) => unknown, fail?: (e: unknown) => unknown) => Promise.resolve(res).then(ok, fail)
  return q
}

const pagina = (n: number, desde = 0) => Array.from({ length: n }, (_, i) => ({ id: desde + i }))
const fallo = { message: 'simulated network failure' }

beforeEach(() => vi.resetAllMocks())

describe('fetchUniverso', () => {
  it('ordena por id, recorre hasta la página incompleta y pasa la señal a cada página', async () => {
    const first = query({ data: pagina(1000), error: null })
    const last = query({ data: pagina(1, 1000), error: null })
    m.from.mockReturnValueOnce(first).mockReturnValueOnce(last)
    const { signal } = new AbortController()

    expect(await fetchUniverso(signal)).toHaveLength(1001)
    expect(first.order).toHaveBeenCalledWith('id')
    expect(first.range).toHaveBeenCalledWith(0, 999)
    expect(last.range).toHaveBeenCalledWith(1000, 1999)
    expect(first.abortSignal).toHaveBeenCalledWith(signal)
    expect(last.abortSignal).toHaveBeenCalledWith(signal)
  })

  it('cancelado entre páginas: no pide la siguiente', async () => {
    const controller = new AbortController()
    const first = query({ data: pagina(1000), error: null })
    first.range = vi.fn(() => {
      controller.abort()
      return first
    })
    m.from.mockReturnValue(first)

    await expect(fetchUniverso(controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(m.from).toHaveBeenCalledTimes(1)
  })

  it('ya cancelado: no toca la red', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(fetchUniverso(controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(m.from).not.toHaveBeenCalled()
  })

  it('sin señal conserva el contrato anterior', async () => {
    const q = query({ data: pagina(2), error: null })
    m.from.mockReturnValue(q)
    expect(await fetchUniverso()).toHaveLength(2)
    expect(q.abortSignal).not.toHaveBeenCalled()
  })

  it('propaga el error de una página', async () => {
    m.from.mockReturnValue(query({ data: null, error: fallo }))
    await expect(fetchUniverso()).rejects.toBe(fallo)
  })
})

describe('fetchAnalisisScore', () => {
  it('sin ids no consulta; 2001 ids van en tres lotes con la misma señal', async () => {
    const q = query({ data: [], error: null })
    m.from.mockReturnValue(q)
    const { signal } = new AbortController()
    expect(await fetchAnalisisScore([], signal)).toEqual([])
    expect(m.from).not.toHaveBeenCalled()

    await fetchAnalisisScore(pagina(2001).map(r => r.id), signal)
    expect(m.from).toHaveBeenCalledTimes(3)
    expect(q.abortSignal).toHaveBeenCalledTimes(3)
    expect(q.abortSignal).toHaveBeenCalledWith(signal)
  })

  it('cancelado antes de empezar: no consulta', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(fetchAnalisisScore([1, 2], controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(m.from).not.toHaveBeenCalled()
  })

  it('conserva contrato_id y pdf_hash de cada fila', async () => {
    m.from.mockReturnValue(query({ data: [{ contrato_id: 7, pdf_hash: 'abc' }, { contrato_id: 7, pdf_hash: 'def' }], error: null }))
    const filas = await fetchAnalisisScore([7])
    expect(filas.map(f => [f.contrato_id, f.pdf_hash])).toEqual([[7, 'abc'], [7, 'def']])
  })
})

describe('lecturas pequeñas', () => {
  it('ocultos: un fallo se lanza; sin filas es conjunto vacío real', async () => {
    m.from.mockReturnValueOnce(query({ data: null, error: fallo }))
    await expect(cargarOcultos('user-a')).rejects.toBe(fallo)

    m.from.mockReturnValueOnce(query({ data: [], error: null }))
    expect(await cargarOcultos('user-a')).toEqual(new Set())
  })

  it('ocultos: filtra por la cuenta pedida y pasa la señal', async () => {
    const q = query({ data: [{ contrato_id: 3 }], error: null })
    m.from.mockReturnValue(q)
    const { signal } = new AbortController()
    expect(await cargarOcultos('user-a', signal)).toEqual(new Set([3]))
    expect(m.from).toHaveBeenCalledWith('ruta_ocultos')
    expect(q.eq).toHaveBeenCalledWith('user_id', 'user-a')
    expect(q.abortSignal).toHaveBeenCalledWith(signal)
  })

  it('pipeline: un fallo se lanza; sin fila devuelve null', async () => {
    m.from.mockReturnValueOnce(query({ data: null, error: fallo }))
    await expect(cargarEstadoPipeline()).rejects.toBe(fallo)

    m.from.mockReturnValueOnce(query({ data: null, error: null }))
    expect(await cargarEstadoPipeline()).toBeNull()
  })
})

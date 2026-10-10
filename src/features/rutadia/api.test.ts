/** API de Diario contra un doble del builder PostgREST: paginación guiada por
 *  el conteo del servidor, señal de cancelación propagada, lecturas incompletas
 *  declaradas y errores que ya no se disfrazan de ausencia. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_FILAS, cargarEstadoPipeline, cargarOcultos, fetchAnalisisScore, fetchUniverso, ocultarContrato, restaurarContrato } from './api'

const m = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('../../lib/supabase', () => ({ supabase: { from: m.from } }))

type Res = { data: unknown; error: unknown; count?: number | null }

function query(res: Res) {
  const q: Record<string, ReturnType<typeof vi.fn>> & { then?: unknown } = {}
  for (const key of ['select', 'in', 'or', 'order', 'range', 'limit', 'eq', 'abortSignal']) q[key] = vi.fn(() => q)
  q.maybeSingle = vi.fn(async () => res)
  q.then = (ok: (v: Res) => unknown, fail?: (e: unknown) => unknown) => Promise.resolve(res).then(ok, fail)
  return q
}

/** Servidor simulado: `filas` existentes y `maxRows` por respuesta, como PostgREST. */
function servidor(filas: unknown[], maxRows = 1000) {
  const consultas: ReturnType<typeof query>[] = []
  m.from.mockImplementation(() => {
    const q = query({ data: [], error: null })
    let desde = 0
    let hasta = 0
    let contar = false
    q.select = vi.fn((_cols: string, opts?: { count?: string }) => {
      contar = opts?.count === 'exact'
      return q
    })
    q.range = vi.fn((a: number, b: number) => {
      desde = a
      hasta = b
      return q
    })
    q.then = (ok: (v: Res) => unknown, fail?: (e: unknown) => unknown) => Promise.resolve({
      data: filas.slice(desde, Math.min(hasta + 1, desde + maxRows)),
      error: null,
      count: contar ? filas.length : null,
    }).then(ok, fail)
    consultas.push(q)
    return q
  })
  return consultas
}

const ids = (n: number, desde = 0) => Array.from({ length: n }, (_, i) => ({ id: desde + i }))
const fallo = { message: 'simulated network failure' }

beforeEach(() => vi.resetAllMocks())

describe('fetchUniverso', () => {
  it('ordena por id, pide el conteo exacto solo en la primera página y pasa la señal a todas', async () => {
    const consultas = servidor(ids(1001))
    const { signal } = new AbortController()

    const lectura = await fetchUniverso(signal)
    expect(lectura).toMatchObject({ completo: true, total: 1001 })
    expect(lectura.filas).toHaveLength(1001)
    expect(consultas).toHaveLength(2)
    expect(consultas[0].order).toHaveBeenCalledWith('id')
    expect(consultas[0].range).toHaveBeenCalledWith(0, 999)
    expect(consultas[1].range).toHaveBeenCalledWith(1000, 1999)
    expect(consultas[0].select.mock.calls[0][1]).toEqual({ count: 'exact' })
    expect(consultas[1].select.mock.calls[0][1]).toBeUndefined()
    for (const q of consultas) expect(q.abortSignal).toHaveBeenCalledWith(signal)
  })

  it('exactamente una página llena no necesita otra consulta para saber que terminó', async () => {
    const consultas = servidor(ids(1000))
    expect((await fetchUniverso()).filas).toHaveLength(1000)
    expect(consultas).toHaveLength(1)
  })

  it('max_rows del servidor menor que la página: no trunca, sigue desde lo ya leído', async () => {
    const consultas = servidor(ids(921), 400)
    const lectura = await fetchUniverso()
    expect(lectura.filas.map(f => f.id)).toEqual(ids(921).map(f => f.id))
    expect(lectura.completo).toBe(true)
    expect(consultas.map(q => q.range.mock.calls[0][0])).toEqual([0, 400, 800])
  })

  it('al alcanzar el tope declara la lectura incompleta con el total real', async () => {
    servidor(ids(MAX_FILAS + 5))
    const lectura = await fetchUniverso()
    expect(lectura.filas).toHaveLength(MAX_FILAS)
    expect(lectura).toMatchObject({ completo: false, total: MAX_FILAS + 5 })
  })

  it('universo de exactamente el tope es completo', async () => {
    servidor(ids(MAX_FILAS))
    expect(await fetchUniverso()).toMatchObject({ completo: true, total: MAX_FILAS })
  })

  it('sin conteo del servidor conserva el fin por página incompleta', async () => {
    m.from
      .mockReturnValueOnce(query({ data: ids(1000), error: null, count: null }))
      .mockReturnValueOnce(query({ data: ids(1, 1000), error: null }))
    expect(await fetchUniverso()).toMatchObject({ completo: true, total: null })
    expect(m.from).toHaveBeenCalledTimes(2)
  })

  it('cancelado entre páginas: no pide la siguiente', async () => {
    const controller = new AbortController()
    const consultas = servidor(ids(2500))
    const original = m.from.getMockImplementation()!
    m.from.mockImplementation((...a: unknown[]) => {
      const q = original(...a)
      controller.abort()
      return q
    })
    await expect(fetchUniverso(controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(consultas).toHaveLength(1)
  })

  it('ya cancelado: no toca la red', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(fetchUniverso(controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(m.from).not.toHaveBeenCalled()
  })

  it('sin señal no la exige al transporte', async () => {
    const consultas = servidor(ids(2))
    expect((await fetchUniverso()).filas).toHaveLength(2)
    expect(consultas[0].abortSignal).not.toHaveBeenCalled()
  })

  it('propaga el error de una página', async () => {
    m.from.mockReturnValue(query({ data: null, error: fallo }))
    await expect(fetchUniverso()).rejects.toBe(fallo)
  })
})

describe('fetchAnalisisScore', () => {
  it('sin ids no consulta; 2001 ids van en tres lotes con la misma señal', async () => {
    const consultas = servidor([])
    const { signal } = new AbortController()
    expect(await fetchAnalisisScore([], signal)).toEqual({ filas: [], completo: true, total: 0 })
    expect(m.from).not.toHaveBeenCalled()

    await fetchAnalisisScore(ids(2001).map(r => r.id), signal)
    expect(consultas).toHaveLength(3)
    for (const q of consultas) expect(q.abortSignal).toHaveBeenCalledWith(signal)
  })

  it('un lote con más filas que el límite del servidor se pagina sin perder hashes', async () => {
    // 600 contratos con dos hashes de TDR cada uno: 1200 filas en un solo lote de ids.
    const filas = Array.from({ length: 600 }, (_, i) => [
      { contrato_id: i, pdf_hash: 'a' },
      { contrato_id: i, pdf_hash: 'b' },
    ]).flat()
    const consultas = servidor(filas)
    const lectura = await fetchAnalisisScore(Array.from({ length: 600 }, (_, i) => i))

    expect(lectura).toMatchObject({ completo: true, total: 1200 })
    expect(new Set(lectura.filas.map(f => `${f.contrato_id}|${f.pdf_hash}`)).size).toBe(1200)
    expect(consultas).toHaveLength(2)
    expect(consultas[0].order.mock.calls.map(c => c[0])).toEqual(['contrato_id', 'pdf_hash'])
    expect(consultas[1].range).toHaveBeenCalledWith(1000, 1999)
  })

  it('cancelado antes de empezar: no consulta', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(fetchAnalisisScore([1, 2], controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(m.from).not.toHaveBeenCalled()
  })

  it('propaga el error de un lote', async () => {
    m.from.mockReturnValue(query({ data: null, error: fallo }))
    await expect(fetchAnalisisScore([1])).rejects.toBe(fallo)
  })
})

describe('escritura de ocultos (UX-004)', () => {
  function escritura(error: unknown) {
    const q = query({ data: null, error })
    q.insert = vi.fn(() => q)
    q.delete = vi.fn(() => q)
    m.from.mockReturnValue(q)
    return q
  }

  it('ocultar: éxito, fallo y reintento sobre uno ya oculto (clave duplicada = éxito)', async () => {
    escritura(null)
    expect(await ocultarContrato('user-a', 5)).toBe(true)
    escritura({ code: '42501', message: 'rls' })
    expect(await ocultarContrato('user-a', 5)).toBe(false)
    escritura({ code: '23505', message: 'duplicate key' })
    expect(await ocultarContrato('user-a', 5)).toBe(true)
  })

  it('ocultar y restaurar escriben solo la fila de la cuenta y pasan la señal', async () => {
    const { signal } = new AbortController()
    const ins = escritura(null)
    await ocultarContrato('user-a', 5, signal)
    expect(ins.insert).toHaveBeenCalledWith({ user_id: 'user-a', contrato_id: 5 })
    expect(ins.abortSignal).toHaveBeenCalledWith(signal)

    const del = escritura(null)
    expect(await restaurarContrato('user-a', 5, signal)).toBe(true)
    expect(del.eq.mock.calls).toEqual([['user_id', 'user-a'], ['contrato_id', 5]])
    expect(del.abortSignal).toHaveBeenCalledWith(signal)
    escritura({ message: 'boom' })
    expect(await restaurarContrato('user-a', 5)).toBe(false)
  })
})

describe('lecturas pequeñas', () => {
  it('ocultos: un fallo se lanza; sin filas es conjunto vacío real', async () => {
    m.from.mockReturnValueOnce(query({ data: null, error: fallo }))
    await expect(cargarOcultos('user-a')).rejects.toBe(fallo)

    servidor([])
    expect(await cargarOcultos('user-a')).toEqual(new Set())
  })

  it('ocultos: filtra por la cuenta pedida, pasa la señal y pagina más de mil', async () => {
    const consultas = servidor(Array.from({ length: 1003 }, (_, i) => ({ contrato_id: i })))
    const { signal } = new AbortController()
    expect((await cargarOcultos('user-a', signal)).size).toBe(1003)
    expect(m.from).toHaveBeenCalledWith('ruta_ocultos')
    expect(consultas).toHaveLength(2)
    for (const q of consultas) {
      expect(q.eq).toHaveBeenCalledWith('user_id', 'user-a')
      expect(q.abortSignal).toHaveBeenCalledWith(signal)
    }
  })

  it('pipeline: un fallo se lanza; sin fila devuelve null', async () => {
    m.from.mockReturnValueOnce(query({ data: null, error: fallo }))
    await expect(cargarEstadoPipeline()).rejects.toBe(fallo)

    m.from.mockReturnValueOnce(query({ data: null, error: null }))
    expect(await cargarEstadoPipeline()).toBeNull()
  })
})

// @vitest-environment jsdom
/** Arranque de Diario con el hook real y la API simulada: coherencia de
 *  preferencias, identidad estable, cancelación, plazo y aislamiento por cuenta. */
import '../../test/dom'
import { StrictMode } from 'react'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Contrato } from '../../types'
import { PLAZO_LECTURA_MS, PLAZO_UNIVERSO_MS, REFRESCO_RELOJ_MS, useRutaDia } from './useRutaDia'

const m = vi.hoisted(() => ({
  auth: { session: { user: { id: 'user-a' } } as { user: { id: string } } | null },
  universo: vi.fn(),
  analisis: vi.fn(),
  pipeline: vi.fn(),
  ocultos: vi.fn(),
  ocultar: vi.fn(),
  restaurar: vi.fn(),
}))
vi.mock('../../lib/auth', () => ({ useAuth: () => m.auth }))
// Los dobles devuelven filas; el adaptador las presenta como lectura completa
// salvo que la prueba entregue una Lectura explícita (p. ej. incompleta).
vi.mock('./api', () => {
  const comoLectura = (v: unknown) => (Array.isArray(v) ? { filas: v, completo: true, total: v.length } : v)
  return {
  fetchUniverso: async (...a: unknown[]) => comoLectura(await m.universo(...a)),
  fetchAnalisisScore: async (...a: unknown[]) => comoLectura(await m.analisis(...a)),
  cargarEstadoPipeline: m.pipeline,
  cargarOcultos: m.ocultos,
  ocultarContrato: m.ocultar,
  restaurarContrato: m.restaurar,
  }
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function postulable(id: number): Contrato {
  return {
    id,
    nro_contratacion: `N° ${id}`,
    descripcion_contrato: '',
    objeto: 'Servicio',
    descripcion: `Servicio de software ${id}`,
    entidad: 'Entidad X',
    estado: 'Vigente',
    fecha_publica: '2026-09-25T10:00:00-05:00',
    fecha_ini_cotizacion: '2026-09-20T08:00:00-05:00',
    fecha_fin_cotizacion: '2099-01-01T00:00:00-05:00',
    tipo_cotizacion: null,
    cotizar: null,
    categoria_it: null,
    relevancia_ia: null,
    pdf_hash: `h${id}`,
  }
}

const senalDe = (mock: ReturnType<typeof vi.fn>, llamada = 0) => mock.mock.calls[llamada].at(-1) as AbortSignal

beforeEach(() => {
  vi.resetAllMocks()
  m.auth.session = { user: { id: 'user-a' } }
  m.universo.mockResolvedValue([])
  m.analisis.mockResolvedValue([])
  m.pipeline.mockResolvedValue(null)
  m.ocultos.mockResolvedValue(new Set())
  m.ocultar.mockResolvedValue(true)
  m.restaurar.mockResolvedValue(true)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('preferencias de ocultos coherentes con la lista', () => {
  it('la lista espera a los ocultos: no se muestra antes de aplicarlos', async () => {
    const d = deferred<Set<number>>()
    m.ocultos.mockReturnValue(d.promise)
    m.universo.mockResolvedValue([postulable(1), postulable(2)])
    const { result } = renderHook(useRutaDia)
    await waitFor(() => expect(m.analisis).toHaveBeenCalledTimes(1))
    expect(result.current.loading).toBe(true)

    await act(async () => d.resolve(new Set([2])))
    expect(result.current.loading).toBe(false)
    expect(result.current.postulablesVisibles.map(o => o.contrato.id)).toEqual([1])
    expect(result.current.ocultosList.map(o => o.contrato.id)).toEqual([2])
  })

  it('un fallo de ocultos se señala como error y no como lista vacía; reintentar lo recupera', async () => {
    m.ocultos.mockRejectedValueOnce(new Error('red caída'))
    m.universo.mockResolvedValue([postulable(1), postulable(2)])
    const { result } = renderHook(useRutaDia)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.ocultosError).toBe(true)
    expect(result.current.postulablesVisibles).toHaveLength(2)

    m.ocultos.mockResolvedValue(new Set([1]))
    act(() => result.current.reintentarOcultos())
    await waitFor(() => expect(result.current.ocultosError).toBe(false))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.postulablesVisibles.map(o => o.contrato.id)).toEqual([2])
    expect(m.universo).toHaveBeenCalledTimes(1)
  })
})

describe('identidad estable y aislamiento entre cuentas', () => {
  it('nuevo objeto session de la misma cuenta no repite ninguna lectura', async () => {
    const { result, rerender } = renderHook(useRutaDia)
    await waitFor(() => expect(result.current.loading).toBe(false))
    m.auth.session = { user: { id: 'user-a' } }
    rerender()
    m.auth.session = { user: { id: 'user-a' } }
    rerender()
    expect(m.ocultos).toHaveBeenCalledTimes(1)
    expect(m.universo).toHaveBeenCalledTimes(1)
    expect(m.analisis).toHaveBeenCalledTimes(1)
    expect(m.pipeline).toHaveBeenCalledTimes(1)
  })

  it('al cambiar de cuenta los ocultos de la anterior no se aplican ni un render', async () => {
    m.universo.mockResolvedValue([postulable(1), postulable(2)])
    m.ocultos.mockResolvedValueOnce(new Set([1]))
    const { result, rerender } = renderHook(useRutaDia)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.ocultos.has(1)).toBe(true)

    const b = deferred<Set<number>>()
    m.ocultos.mockReturnValue(b.promise)
    m.auth.session = { user: { id: 'user-b' } }
    rerender()
    expect(result.current.ocultos.size).toBe(0)
    expect(result.current.loading).toBe(true)
    expect(m.ocultos).toHaveBeenLastCalledWith('user-b', expect.any(AbortSignal))

    await act(async () => b.resolve(new Set([2])))
    expect(result.current.postulablesVisibles.map(o => o.contrato.id)).toEqual([1])
    expect(m.universo).toHaveBeenCalledTimes(1)
  })

  it('respuesta tardía de la cuenta anterior se descarta aunque llegue después', async () => {
    const a = deferred<Set<number>>()
    const b = deferred<Set<number>>()
    m.ocultos.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise)
    const { result, rerender } = renderHook(useRutaDia)
    m.auth.session = { user: { id: 'user-b' } }
    rerender()
    expect(senalDe(m.ocultos, 0).aborted).toBe(true)

    await act(async () => b.resolve(new Set([7])))
    await act(async () => a.resolve(new Set([99])))
    expect([...result.current.ocultos]).toEqual([7])
  })

  it('el rollback de un ocultar fallido no toca los ocultos de otra cuenta', async () => {
    const insert = deferred<boolean>()
    m.ocultar.mockReturnValue(insert.promise)
    const { result, rerender } = renderHook(useRutaDia)
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => { void result.current.ocultar(5) })
    expect(result.current.ocultos.has(5)).toBe(true)

    m.ocultos.mockResolvedValue(new Set([5]))
    m.auth.session = { user: { id: 'user-b' } }
    rerender()
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => insert.resolve(false))
    expect(result.current.ocultos.has(5)).toBe(true)
  })

  it('sin sesión no consulta ocultos ni bloquea la lista', async () => {
    m.auth.session = null
    const { result } = renderHook(useRutaDia)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(m.ocultos).not.toHaveBeenCalled()
  })
})

describe('cancelación y plazo', () => {
  it('salir durante el universo aborta el transporte y no inicia el análisis', async () => {
    const d = deferred<Contrato[]>()
    m.universo.mockReturnValue(d.promise)
    const { unmount } = renderHook(useRutaDia)
    unmount()
    expect(senalDe(m.universo).aborted).toBe(true)
    expect(senalDe(m.pipeline).aborted).toBe(true)
    expect(senalDe(m.ocultos).aborted).toBe(true)
    await act(async () => d.resolve([postulable(1)]))
    expect(m.analisis).not.toHaveBeenCalled()
  })

  it('StrictMode: el primer montaje queda abortado y su universo no dispara análisis', async () => {
    const primero = deferred<Contrato[]>()
    m.universo.mockReturnValueOnce(primero.promise).mockResolvedValue([])
    const { result } = renderHook(useRutaDia, { wrapper: StrictMode })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(senalDe(m.universo, 0).aborted).toBe(true)
    await act(async () => primero.resolve([postulable(1)]))
    expect(m.analisis).toHaveBeenCalledTimes(1)
    expect(result.current.scored).toHaveLength(0)
  })

  it('universo que no responde vence con error recuperable y recargar lo resuelve', async () => {
    vi.useFakeTimers()
    m.universo.mockImplementationOnce((signal: AbortSignal) => new Promise((_res, rej) => {
      signal.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')))
    }))
    const { result } = renderHook(useRutaDia)
    await act(async () => { await vi.advanceTimersByTimeAsync(PLAZO_UNIVERSO_MS) })
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toMatch(/tardó demasiado/)
    expect(m.analisis).not.toHaveBeenCalled()

    m.universo.mockResolvedValue([postulable(1)])
    act(() => result.current.recargar())
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(result.current.error).toBeNull()
    expect(result.current.scored).toHaveLength(1)
  })

  it('ocultos que no responde vence, señala error y libera la lista', async () => {
    vi.useFakeTimers()
    m.ocultos.mockImplementationOnce((_id: string, signal: AbortSignal) => new Promise((_res, rej) => {
      signal.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')))
    }))
    const { result } = renderHook(useRutaDia)
    await act(async () => { await vi.advanceTimersByTimeAsync(PLAZO_LECTURA_MS - 1) })
    expect(result.current.loading).toBe(true)
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(result.current.loading).toBe(false)
    expect(result.current.ocultosError).toBe(true)
  })

  it('error del universo se muestra y recargar repite universo y análisis', async () => {
    m.universo.mockRejectedValueOnce(new Error('fallo de red'))
    const { result } = renderHook(useRutaDia)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('fallo de red')

    m.universo.mockResolvedValue([postulable(3)])
    act(() => result.current.recargar())
    await waitFor(() => expect(result.current.scored).toHaveLength(1))
    expect(result.current.error).toBeNull()
    expect(m.ocultos).toHaveBeenCalledTimes(1)
  })
})

describe('pipeline informativo', () => {
  it('su fallo no bloquea la lista, se distingue de "sin dato" y se puede reintentar', async () => {
    m.pipeline.mockRejectedValueOnce(new Error('timeout'))
    m.universo.mockResolvedValue([postulable(1)])
    const { result } = renderHook(useRutaDia)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.pipelineError).toBe(true)
    expect(result.current.scored).toHaveLength(1)

    m.pipeline.mockResolvedValue({ ultima_corrida_utc: '2026-10-09T10:00:00Z', ultima_ingesta_utc: null })
    act(() => result.current.reintentarPipeline())
    await waitFor(() => expect(result.current.actualizado).toBe('2026-10-09T10:00:00Z'))
    expect(result.current.pipelineError).toBe(false)
    expect(m.universo).toHaveBeenCalledTimes(1)
  })

  it('tabla sin fila es ausencia, no error', async () => {
    const { result } = renderHook(useRutaDia)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.pipelineError).toBe(false)
    expect(result.current.actualizado).toBeNull()
  })
})

describe('escritura de ocultos (UX-004)', () => {
  it('ocultar que falla: se revierte y deja un aviso; el siguiente intento lo limpia', async () => {
    m.universo.mockResolvedValue([postulable(1)])
    m.ocultar.mockResolvedValueOnce(false)
    const { result } = renderHook(useRutaDia)
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.ocultar(1) })
    expect(result.current.ocultos.has(1)).toBe(false)
    expect(result.current.accionOcultosError).toMatch(/No pudimos ocultar/)

    await act(async () => { await result.current.ocultar(1) })
    expect(result.current.ocultos.has(1)).toBe(true)
    expect(result.current.accionOcultosError).toBeNull()
  })

  it('restaurar que lanza: el proyecto sigue oculto y se avisa', async () => {
    m.ocultos.mockResolvedValue(new Set([4]))
    m.restaurar.mockRejectedValueOnce(new Error('red'))
    const { result } = renderHook(useRutaDia)
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => { await result.current.restaurar(4) })
    expect(result.current.ocultos.has(4)).toBe(true)
    expect(result.current.accionOcultosError).toMatch(/sigue oculto/)
  })

  it('escritura sin respuesta: vence por plazo, aborta el transporte y revierte', async () => {
    vi.useFakeTimers()
    m.ocultar.mockImplementationOnce((_u: string, _id: number, signal: AbortSignal) => new Promise((_res, rej) => {
      signal.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')))
    }))
    const { result } = renderHook(useRutaDia)
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    act(() => { void result.current.ocultar(9) })
    expect(result.current.ocultos.has(9)).toBe(true)
    await act(async () => { await vi.advanceTimersByTimeAsync(PLAZO_LECTURA_MS) })
    expect(result.current.ocultos.has(9)).toBe(false)
    expect(result.current.accionOcultosError).toMatch(/No pudimos ocultar/)
  })

  it('el aviso de una cuenta no se muestra a otra', async () => {
    m.ocultar.mockResolvedValueOnce(false)
    const { result, rerender } = renderHook(useRutaDia)
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => { await result.current.ocultar(1) })
    expect(result.current.accionOcultosError).not.toBeNull()
    m.auth.session = { user: { id: 'user-b' } }
    rerender()
    expect(result.current.accionOcultosError).toBeNull()
  })

  it('la escritura lleva la cuenta que la inició y una señal de cancelación', async () => {
    const { result } = renderHook(useRutaDia)
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => { await result.current.ocultar(3) })
    expect(m.ocultar).toHaveBeenCalledWith('user-a', 3, expect.any(AbortSignal))
  })
})

describe('integridad y frescura', () => {
  it('lectura incompleta del universo se declara con cargados y total', async () => {
    m.universo.mockResolvedValue({ filas: [postulable(1)], completo: false, total: 25000 })
    const { result } = renderHook(useRutaDia)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.universoIncompleto).toEqual({ cargados: 1, total: 25000 })
    expect(result.current.scored).toHaveLength(1)

    m.universo.mockResolvedValue([postulable(1), postulable(2)])
    act(() => result.current.recargar())
    await waitFor(() => expect(result.current.scored).toHaveLength(2))
    expect(result.current.universoIncompleto).toBeNull()
  })

  it('análisis incompleto se declara sin ocultar la lista', async () => {
    m.universo.mockResolvedValue([postulable(1)])
    m.analisis.mockResolvedValue({ filas: [], completo: false, total: null })
    const { result } = renderHook(useRutaDia)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.analisisIncompleto).toBe(true)
    expect(result.current.universoIncompleto).toBeNull()
    expect(result.current.scored).toHaveLength(1)
  })

  it('con la pantalla abierta, un contrato deja de ser postulable al vencer sin recargar datos', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-10T23:58:30-05:00'))
    m.universo.mockResolvedValue([
      { ...postulable(1), fecha_fin_cotizacion: '2026-10-10T23:59:00-05:00' },
      postulable(2),
    ])
    const { result } = renderHook(useRutaDia)
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(result.current.postulablesVisibles.map(o => o.contrato.id).sort()).toEqual([1, 2])
    expect(result.current.kpis.cierranHoy).toBe(1)

    await act(async () => { await vi.advanceTimersByTimeAsync(REFRESCO_RELOJ_MS) })
    expect(result.current.postulablesVisibles.map(o => o.contrato.id)).toEqual([2])
    expect(result.current.kpis.cierranHoy).toBe(0)
    expect(m.universo).toHaveBeenCalledTimes(1)
    expect(m.analisis).toHaveBeenCalledTimes(1)
  })

  it('salir y volver a Diario relee los datos: no hay caché que pueda quedar atrasada o cruzar cuentas', async () => {
    m.universo.mockResolvedValue([postulable(1)])
    const primera = renderHook(useRutaDia)
    await waitFor(() => expect(primera.result.current.loading).toBe(false))
    primera.unmount()

    m.auth.session = { user: { id: 'user-b' } }
    m.universo.mockResolvedValue([postulable(1), postulable(2)])
    m.ocultos.mockResolvedValue(new Set([2]))
    const segunda = renderHook(useRutaDia)
    await waitFor(() => expect(segunda.result.current.loading).toBe(false))
    expect(segunda.result.current.scored).toHaveLength(2)
    expect(segunda.result.current.postulablesVisibles.map(o => o.contrato.id)).toEqual([1])
    expect(m.universo).toHaveBeenCalledTimes(2)
    expect(m.ocultos).toHaveBeenLastCalledWith('user-b', expect.any(AbortSignal))
  })

  it('el reloj no avanza con la pestaña oculta y se pone al día al volver', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-10T23:58:30-05:00'))
    m.universo.mockResolvedValue([{ ...postulable(1), fecha_fin_cotizacion: '2026-10-10T23:59:00-05:00' }])
    const visibilidad = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    const { result } = renderHook(useRutaDia)
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    await act(async () => { await vi.advanceTimersByTimeAsync(REFRESCO_RELOJ_MS * 3) })
    expect(result.current.postulablesVisibles).toHaveLength(1)

    visibilidad.mockReturnValue('visible')
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(result.current.postulablesVisibles).toHaveLength(0)
    visibilidad.mockRestore()
  })
})

describe('contrato preservado', () => {
  it('filtros y paginación no vuelven a consultar', async () => {
    const { result } = renderHook(useRutaDia)
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => {
      result.current.setNivel('nucleo')
      result.current.setPaginaPost(2)
      result.current.setTamPagina(20)
    })
    expect(m.universo).toHaveBeenCalledTimes(1)
    expect(m.analisis).toHaveBeenCalledTimes(1)
    expect(m.ocultos).toHaveBeenCalledTimes(1)
    expect(m.pipeline).toHaveBeenCalledTimes(1)
  })

  it('el análisis recibe los ids del universo y solo después de él', async () => {
    const d = deferred<Contrato[]>()
    m.universo.mockReturnValue(d.promise)
    renderHook(useRutaDia)
    expect(m.analisis).not.toHaveBeenCalled()
    await act(async () => d.resolve([postulable(4), postulable(9)]))
    expect(m.analisis).toHaveBeenCalledWith([4, 9], expect.any(AbortSignal))
  })
})

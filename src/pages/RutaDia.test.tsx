// @vitest-environment jsdom
/** Diario con hook real y API simulada: los fallos de carga se ven como error
 *  recuperable en pantalla, sin recargar la página ni parecer lista vacía. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RutaDia from './RutaDia'
import { authState, fakeSession, perfilNormal, renderUI, setAuth } from '../test/dom'

const m = vi.hoisted(() => ({
  universo: vi.fn(),
  analisis: vi.fn(),
  pipeline: vi.fn(),
  ocultos: vi.fn(),
}))
vi.mock('../lib/auth', () => ({ useAuth: () => authState }))
vi.mock('../lib/supabase', () => import('../test/fakeSupabase'))
vi.mock('../features/rutadia/api', () => {
  const comoLectura = (v: unknown) => (Array.isArray(v) ? { filas: v, completo: true, total: v.length } : v)
  return {
    fetchUniverso: async (...a: unknown[]) => comoLectura(await m.universo(...a)),
    fetchAnalisisScore: async (...a: unknown[]) => comoLectura(await m.analisis(...a)),
    cargarEstadoPipeline: m.pipeline,
    cargarOcultos: m.ocultos,
    ocultarContrato: vi.fn(async () => true),
    restaurarContrato: vi.fn(async () => true),
  }
})

beforeEach(() => {
  vi.resetAllMocks()
  setAuth({ session: fakeSession, perfil: perfilNormal })
  m.universo.mockResolvedValue([])
  m.analisis.mockResolvedValue([])
  m.pipeline.mockResolvedValue(null)
  m.ocultos.mockResolvedValue(new Set())
})

describe('Diario: errores de carga recuperables', () => {
  it('fallo de ocultos: aviso propio y reintento que solo repite esa lectura', async () => {
    m.ocultos.mockRejectedValueOnce(new Error('red'))
    renderUI(<RutaDia />)
    expect(await screen.findByText(/No pudimos cargar tus proyectos ocultos/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Sin postulables con esos filtros')).toBeInTheDocument()
    expect(screen.queryByText(/No pudimos cargar tus proyectos ocultos/)).not.toBeInTheDocument()
    expect(m.ocultos).toHaveBeenCalledTimes(2)
    expect(m.universo).toHaveBeenCalledTimes(1)
  })

  it('fallo del universo: reintentar vuelve a cargar sin recargar la página', async () => {
    m.universo.mockRejectedValueOnce(new Error('fallo de red'))
    renderUI(<RutaDia />)
    expect(await screen.findByText('fallo de red')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Nuevos hoy')).toBeInTheDocument()
    expect(screen.queryByText('fallo de red')).not.toBeInTheDocument()
    expect(m.universo).toHaveBeenCalledTimes(2)
  })

  it('lectura incompleta: avisa cuántos contratos se cargaron del total', async () => {
    m.universo.mockResolvedValue({ filas: [], completo: false, total: 25000 })
    m.analisis.mockResolvedValue({ filas: [], completo: false, total: null })
    renderUI(<RutaDia />)
    expect(await screen.findByText(/Lista incompleta: se cargaron 0 de 25,000 contratos/)).toBeInTheDocument()
    expect(screen.getByText(/No se cargaron todos los análisis/)).toBeInTheDocument()
  })

  it('lectura completa: sin avisos de integridad', async () => {
    renderUI(<RutaDia />)
    expect(await screen.findByText('Sin postulables con esos filtros')).toBeInTheDocument()
    expect(screen.queryByText(/Lista incompleta/)).not.toBeInTheDocument()
    expect(screen.queryByText(/No se cargaron todos los análisis/)).not.toBeInTheDocument()
  })

  it('fallo del pipeline: no se presenta como "sin dato" ni oculta la lista', async () => {
    m.pipeline.mockRejectedValueOnce(new Error('timeout'))
    renderUI(<RutaDia />)
    expect(await screen.findByText(/No pudimos leer la última actualización/)).toBeInTheDocument()
    expect(screen.queryByText(/sin dato/)).not.toBeInTheDocument()
    expect(await screen.findByText('Nuevos hoy')).toBeInTheDocument()

    m.pipeline.mockResolvedValue(null)
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Análisis: sin dato')).toBeInTheDocument()
  })
})

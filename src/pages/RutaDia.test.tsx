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
  convocatorias: vi.fn(),
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
    fetchConvocatorias: async (...a: unknown[]) => comoLectura(await m.convocatorias(...a)),
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
  m.convocatorias.mockResolvedValue([])
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

describe('Diario: filtro de convocatorias', () => {
  const contrato = (id: number, descripcion: string) => ({
    id,
    nro_contratacion: `N° ${id}`,
    descripcion_contrato: '',
    objeto: 'Servicio',
    descripcion,
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
  })
  const convocatoria = (contratoId: number, numero: number, esActual: boolean, resultado: string | null) => ({
    contrato_id: contratoId,
    convocatoria_id: contratoId * 100 + numero,
    numero,
    total: 2,
    es_actual: esActual,
    nro_contratacion: null,
    descripcion_contrato: null,
    estado: 'Culminado',
    fecha_publica: null,
    fecha_ini_cotizacion: null,
    fecha_fin_cotizacion: null,
    resultado,
    proveedor_ganador: null,
    monto_adjudicado: null,
    pdf_archivo_id: null,
    pdf_storage_path: null,
  })

  it('los accesos muestran el conteo y recortan la lista; «Ver todas» la restaura', async () => {
    m.universo.mockResolvedValue([
      contrato(4, 'Servicio de software primera vez'),
      contrato(9, 'Servicio de software reconvocado'),
    ])
    m.convocatorias.mockResolvedValue([convocatoria(9, 1, false, 'DESIERTO'), convocatoria(9, 2, true, null)])
    renderUI(<RutaDia />)

    const acceso = await screen.findByRole('button', { name: /Con desierto previo · 1/ })
    expect(screen.getByRole('button', { name: /Reconvocados · 1/ })).toBeInTheDocument()
    expect(screen.getByText(/primera vez/)).toBeInTheDocument()

    await userEvent.click(acceso)
    expect(screen.queryByText(/primera vez/)).not.toBeInTheDocument()
    expect(screen.getByText(/Servicio de software reconvocado/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Ver todas' }))
    expect(screen.getByText(/primera vez/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ver todas' })).not.toBeInTheDocument()
  })

  it('sin historial no se ofrece el filtro', async () => {
    m.convocatorias.mockRejectedValue(new Error('permiso denegado'))
    renderUI(<RutaDia />)
    expect(await screen.findByText(/No se cargó el historial de convocatorias/)).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Filtrar por convocatoria' })).not.toBeInTheDocument()
  })
})

describe('Diario: cabecera durante el arranque', () => {
  it('mientras llega el estado del pipeline no afirma "sin dato"; lo dice solo si de verdad no hay fila', async () => {
    let resolver!: (v: null) => void
    m.pipeline.mockReturnValue(new Promise((res) => { resolver = res }))
    renderUI(<RutaDia />)
    expect(await screen.findByText('Nuevos hoy')).toBeInTheDocument()
    expect(screen.queryByText(/sin dato/)).toBeNull()
    resolver(null)
    expect(await screen.findByText('Análisis: sin dato')).toBeInTheDocument()
  })
})

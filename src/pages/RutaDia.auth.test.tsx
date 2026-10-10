// @vitest-environment jsdom
/** Diario bajo el AuthProvider y RequireAuth reales: los eventos de Auth de la
 *  misma cuenta no repiten lecturas y el cambio de cuenta no hereda ocultos. */
import '../test/dom'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { AuthProvider } from '../lib/auth'
import { RequireAuth } from '../components/RequireAuth'
import { ThemeProvider } from '../lib/theme'
import RutaDia from './RutaDia'

const m = vi.hoisted(() => ({
  getSession: vi.fn(),
  subscribe: vi.fn(),
  from: vi.fn(),
  universo: vi.fn(),
  analisis: vi.fn(),
  pipeline: vi.fn(),
  ocultos: vi.fn(),
}))
vi.mock('../lib/supabase', () => ({ supabase: {
  auth: { getSession: m.getSession, onAuthStateChange: m.subscribe, signOut: vi.fn() },
  from: m.from,
} }))
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

const session = (id: string) => ({ user: { id } }) as Session
let notify: (event: AuthChangeEvent, next: Session | null) => void

/** Solo la lectura de perfiles pasa por el cliente; devuelve el perfil pedido. */
function perfilQuery() {
  let id = ''
  const builder = {
    select: () => builder,
    eq: (_col: string, valor: string) => {
      id = valor
      return builder
    },
    abortSignal: () => builder,
    maybeSingle: async () => ({
      data: { id, email: `${id}@example.test`, rol: 'normal', creado_por: null, created_at: '' },
      error: null,
    }),
  }
  return builder
}

beforeEach(() => {
  vi.resetAllMocks()
  m.getSession.mockResolvedValue({ data: { session: session('user-a') } })
  m.subscribe.mockImplementation((callback) => {
    notify = callback
    return { data: { subscription: { unsubscribe: vi.fn() } } }
  })
  m.from.mockImplementation(perfilQuery)
  m.universo.mockResolvedValue([])
  m.analisis.mockResolvedValue([])
  m.pipeline.mockResolvedValue(null)
  m.ocultos.mockResolvedValue(new Set())
})
afterEach(cleanup)

function mount() {
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<RequireAuth><RutaDia /></RequireAuth>} />
            <Route path="/login" element={<p>LOGIN</p>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </ThemeProvider>,
  )
}

it('TOKEN_REFRESHED y SIGNED_IN de la misma cuenta no repiten lecturas de Diario', async () => {
  mount()
  expect(await screen.findByText('Sin postulables con esos filtros')).toBeInTheDocument()

  act(() => notify('TOKEN_REFRESHED', session('user-a')))
  act(() => notify('SIGNED_IN', session('user-a')))
  expect(screen.getByText('Sin postulables con esos filtros')).toBeInTheDocument()
  expect(m.universo).toHaveBeenCalledTimes(1)
  expect(m.analisis).toHaveBeenCalledTimes(1)
  expect(m.pipeline).toHaveBeenCalledTimes(1)
  expect(m.ocultos).toHaveBeenCalledTimes(1)
  expect(m.ocultos).toHaveBeenCalledWith('user-a', expect.any(AbortSignal))
})

it('cambio de cuenta: aborta la lectura anterior y pide los ocultos de la nueva', async () => {
  mount()
  await waitFor(() => expect(m.ocultos).toHaveBeenCalledTimes(1))
  const senalA = m.ocultos.mock.calls[0][1] as AbortSignal

  act(() => notify('SIGNED_IN', session('user-b')))
  await waitFor(() => expect(m.ocultos).toHaveBeenLastCalledWith('user-b', expect.any(AbortSignal)))
  expect(senalA.aborted).toBe(true)
  expect(await screen.findByText('Sin postulables con esos filtros')).toBeInTheDocument()
})

it('cerrar sesión durante la carga aborta el universo y no inicia el análisis', async () => {
  let resolver!: (rows: unknown[]) => void
  m.universo.mockReturnValue(new Promise((res) => { resolver = res }))
  mount()
  await waitFor(() => expect(m.universo).toHaveBeenCalledTimes(1))

  act(() => notify('SIGNED_OUT', null))
  expect(screen.getByText('LOGIN')).toBeInTheDocument()
  expect((m.universo.mock.calls[0][0] as AbortSignal).aborted).toBe(true)
  await act(async () => resolver([{ id: 1 }]))
  expect(m.analisis).not.toHaveBeenCalled()
})

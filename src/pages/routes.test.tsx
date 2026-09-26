// @vitest-environment jsdom
/** Smoke DOM de las rutas protegidas: cada página se renderiza bajo RequireAuth
 *  con sesión admin y dobles de Supabase/fetch (sin datos → estados vacíos o de
 *  error real de cada página). No ejercita backend real. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { RequireAuth } from '../components/RequireAuth'
import RutaDia from './RutaDia'
import Dashboard from './Dashboard'
import Buscador from './Buscador'
import Chat from './Chat'
import Docs from './Docs'
import Usuarios from './Usuarios'
import Observabilidad from './Observabilidad'
import Keywords from './Keywords'
import AnalisisContrato from './AnalisisContrato'
import { resetSupabaseFakes } from '../test/fakeSupabase'
import {
  authState,
  fakeSession,
  perfilAdmin,
  renderUI,
  setAuth,
} from '../test/dom'

vi.mock('../lib/auth', async (orig) => ({
  ...(await orig<typeof import('../lib/auth')>()),
  useAuth: () => authState,
}))

vi.mock('../lib/supabase', () => import('../test/fakeSupabase'))

function ruta(
  path: string,
  elemento: React.ReactElement,
  admin = false,
  entrada = path,
) {
  return renderUI(
    <Routes>
      <Route path={path} element={<RequireAuth admin={admin}>{elemento}</RequireAuth>} />
      <Route path="/login" element={<p>LOGIN</p>} />
    </Routes>,
    entrada,
  )
}

beforeEach(() => {
  resetSupabaseFakes()
  setAuth({ session: fakeSession, perfil: perfilAdmin })
})

describe('rutas protegidas', () => {
  it('/ ruta del día: KPIs y estados vacíos tras cargar', async () => {
    ruta('/', <RutaDia />)
    expect(await screen.findByText('Nuevos hoy')).toBeInTheDocument()
    expect(await screen.findByText('Sin postulables con esos filtros')).toBeInTheDocument()
    expect(screen.getByText('Nada en otras etapas')).toBeInTheDocument()
  })

  it('/dashboard: tablero principal tras cargar', async () => {
    ruta('/dashboard', <Dashboard />)
    expect(await screen.findByText('Monitor SEACE')).toBeInTheDocument()
  })

  it('/buscar: formulario del buscador', async () => {
    ruta('/buscar', <Buscador />)
    expect(await screen.findByText('Buscador SEACE')).toBeInTheDocument()
  })

  it('/chat: consola del bot', async () => {
    ruta('/chat', <Chat />)
    expect(await screen.findByText('SEACE Bot')).toBeInTheDocument()
  })

  it('/docs: documentación de la API', () => {
    ruta('/docs', <Docs />)
    expect(screen.getByText('API pública')).toBeInTheDocument()
  })

  it('/usuarios: listado vacío para admin', async () => {
    ruta('/usuarios', <Usuarios />, true)
    expect(screen.getByText('Usuarios')).toBeInTheDocument()
    expect(await screen.findByText('No hay perfiles')).toBeInTheDocument()
  })

  it('/observabilidad: cabecera del panel', async () => {
    ruta('/observabilidad', <Observabilidad />, true)
    expect(await screen.findByText('Observabilidad')).toBeInTheDocument()
  })

  it('/keywords: cabecera del panel', async () => {
    ruta('/keywords', <Keywords />, true)
    expect(await screen.findByText('Keywords')).toBeInTheDocument()
  })

  it('/analisis/:id: cabecera del contrato', async () => {
    ruta('/analisis/:id', <AnalisisContrato />, false, '/analisis/123')
    expect(await screen.findByText('Contrato 123')).toBeInTheDocument()
  })

  it('sin sesión todas las rutas protegidas caen a /login', () => {
    setAuth()
    ruta('/buscar', <Buscador />)
    expect(screen.getByText('LOGIN')).toBeInTheDocument()
    expect(screen.queryByText('Buscador SEACE')).not.toBeInTheDocument()
  })
})

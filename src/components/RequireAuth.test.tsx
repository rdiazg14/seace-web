// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { RequireAuth } from './RequireAuth'
import {
  authState,
  fakeSession,
  perfilAdmin,
  perfilNormal,
  renderUI,
  setAuth,
} from '../test/dom'

vi.mock('../lib/auth', async (orig) => ({
  ...(await orig<typeof import('../lib/auth')>()),
  useAuth: () => authState,
}))

function arbol(admin = false) {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <RequireAuth admin={admin}>
            <p>CONTENIDO PROTEGIDO</p>
          </RequireAuth>
        }
      />
      <Route path="/login" element={<p>PANTALLA LOGIN</p>} />
    </Routes>
  )
}

beforeEach(() => setAuth())

describe('RequireAuth', () => {
  it('muestra skeleton mientras carga la sesión', () => {
    setAuth({ loading: true })
    const { container } = renderUI(arbol())
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(screen.queryByText('CONTENIDO PROTEGIDO')).not.toBeInTheDocument()
    expect(screen.queryByText('PANTALLA LOGIN')).not.toBeInTheDocument()
  })

  it('redirige a /login sin sesión', () => {
    renderUI(arbol())
    expect(screen.getByText('PANTALLA LOGIN')).toBeInTheDocument()
    expect(screen.queryByText('CONTENIDO PROTEGIDO')).not.toBeInTheDocument()
  })

  it('muestra error de perfil con sesión sin fila en perfiles', () => {
    setAuth({ session: fakeSession })
    renderUI(arbol())
    expect(screen.getByText(/no tiene perfil/i)).toBeInTheDocument()
  })

  it('renderiza el contenido con sesión y perfil', () => {
    setAuth({ session: fakeSession, perfil: perfilNormal })
    renderUI(arbol())
    expect(screen.getByText('CONTENIDO PROTEGIDO')).toBeInTheDocument()
  })

  it('bloquea la ruta admin a un perfil normal', () => {
    setAuth({ session: fakeSession, perfil: perfilNormal })
    renderUI(
      <Routes>
        <Route path="/" element={<p>RAÍZ</p>} />
        <Route
          path="/admin"
          element={
            <RequireAuth admin>
              <p>PANEL ADMIN</p>
            </RequireAuth>
          }
        />
      </Routes>,
      '/admin',
    )
    expect(screen.getByText('RAÍZ')).toBeInTheDocument()
    expect(screen.queryByText('PANEL ADMIN')).not.toBeInTheDocument()
  })

  it('permite la ruta admin a un perfil admin', () => {
    setAuth({ session: fakeSession, perfil: perfilAdmin })
    renderUI(
      <Routes>
        <Route
          path="/admin"
          element={
            <RequireAuth admin>
              <p>PANEL ADMIN</p>
            </RequireAuth>
          }
        />
      </Routes>,
      '/admin',
    )
    expect(screen.getByText('PANEL ADMIN')).toBeInTheDocument()
  })
})

// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import Login from './Login'
import RecuperarClave from './RecuperarClave'
import CambiarClave from './CambiarClave'
import { authCalls, resetSupabaseFakes } from '../test/fakeSupabase'
import {
  authState,
  fakeSession,
  perfilNormal,
  renderUI,
  setAuth,
} from '../test/dom'

vi.mock('../lib/auth', async (orig) => ({
  ...(await orig<typeof import('../lib/auth')>()),
  useAuth: () => authState,
}))

vi.mock('../lib/supabase', () => import('../test/fakeSupabase'))

beforeEach(() => {
  resetSupabaseFakes()
  setAuth()
})

describe('Login', () => {
  it('renderiza el formulario de acceso', () => {
    renderUI(<Login />, '/login')
    expect(screen.getByText('SEACE Monitor')).toBeInTheDocument()
    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByText('Clave')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument()
  })

  it('envía credenciales y muestra el error si el login falla', async () => {
    const user = userEvent.setup()
    renderUI(<Login />, '/login')
    await user.type(screen.getByLabelText(/email/i), 'ana@seace.test')
    await user.type(screen.getByLabelText(/clave/i), 'secreto123')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => {
      expect(authCalls.signInWithPassword).toHaveBeenCalledWith({
        email: 'ana@seace.test',
        password: 'secreto123',
      })
    })
    expect(await screen.findByText(/incorrectos/i)).toBeInTheDocument()
  })

  it('modo olvidé mi clave pide el email y confirma sin revelar existencia', async () => {
    const user = userEvent.setup()
    renderUI(<Login />, '/login')
    await user.click(screen.getByRole('button', { name: /olvidé mi clave/i }))
    expect(screen.queryByText('Clave')).not.toBeInTheDocument()

    await user.type(screen.getByLabelText(/email/i), 'ana@seace.test')
    await user.click(screen.getByRole('button', { name: 'Enviar enlace' }))
    await waitFor(() => {
      expect(authCalls.resetPasswordForEmail).toHaveBeenCalledWith(
        'ana@seace.test',
        expect.objectContaining({ redirectTo: expect.stringContaining('/recuperar-clave') }),
      )
    })
    expect(await screen.findByText(/te llegará un enlace/i)).toBeInTheDocument()
  })

  it('redirige al destino original si ya hay sesión', () => {
    setAuth({ session: fakeSession, perfil: perfilNormal })
    renderUI(
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<p>PANEL</p>} />
      </Routes>,
      { ruta: '/login', estado: { from: '/dashboard' } },
    )
    expect(screen.getByText('PANEL')).toBeInTheDocument()
  })
})

describe('CambiarClave', () => {
  it('valida que las claves nuevas coincidan', async () => {
    setAuth({ session: fakeSession, perfil: perfilNormal })
    const user = userEvent.setup()
    renderUI(<CambiarClave />)
    expect(screen.getByText('Cambiar contraseña')).toBeInTheDocument()
    await user.type(screen.getByLabelText(/clave actual/i), 'vieja1234')
    await user.type(screen.getByLabelText(/^nueva clave/i), 'nueva12345')
    await user.type(screen.getByLabelText(/^repetir/i), 'distinta9')
    await user.click(screen.getByRole('button', { name: /guardar|cambiar|actualizar/i }))
    expect(await screen.findByText(/no coinciden|coinciden/i)).toBeInTheDocument()
    expect(authCalls.updateUser).not.toHaveBeenCalled()
  })
})

describe('RecuperarClave', () => {
  it('sin sesión de recuperación muestra el aviso de enlace inválido', () => {
    renderUI(<RecuperarClave />, '/recuperar-clave')
    expect(screen.getByText(/enlace es inválido o ya expiró/i)).toBeInTheDocument()
  })

  it('con sesión de recuperación renderiza el formulario y cambia la clave', async () => {
    setAuth({ session: fakeSession, perfil: perfilNormal })
    const user = userEvent.setup()
    renderUI(<RecuperarClave />, '/recuperar-clave')
    await user.type(screen.getByLabelText(/^nueva clave/i), 'nueva12345')
    await user.type(screen.getByLabelText(/^repetir/i), 'nueva12345')
    await user.click(screen.getByRole('button', { name: /guardar|cambiar|actualizar/i }))
    await waitFor(() => {
      expect(authCalls.updateUser).toHaveBeenCalledWith({ password: 'nueva12345' })
    })
  })
})

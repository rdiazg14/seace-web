// @vitest-environment jsdom
/** Barra de navegación durante el arranque: mientras se resuelve la sesión no
 *  muestra un conjunto parcial de enlaces que luego se reacomoda. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import Navbar from './Navbar'
import { authState, fakeSession, perfilAdmin, perfilNormal, renderUI, setAuth } from '../test/dom'

vi.mock('../lib/auth', () => ({ useAuth: () => authState }))

beforeEach(() => setAuth())

describe('Navbar al iniciar', () => {
  it('con la sesión en resolución reserva el espacio y oculta los enlaces', () => {
    setAuth({ loading: true })
    renderUI(<Navbar />)
    const grupo = screen.getByText('Diario').parentElement!
    expect(grupo.className).toContain('invisible')
    expect(grupo).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByText('Observabilidad')).toBeNull()
  })

  it('al resolver como admin aparecen todos los enlaces a la vez', () => {
    setAuth({ session: fakeSession, perfil: perfilAdmin })
    renderUI(<Navbar />)
    const grupo = screen.getByText('Diario').parentElement!
    expect(grupo.className).not.toContain('invisible')
    for (const enlace of ['Dashboard', 'Chat', 'Observabilidad', 'Keywords', 'Config', 'Usuarios']) {
      expect(screen.getByText(enlace)).toBeInTheDocument()
    }
  })

  it('un usuario normal no recibe enlaces de administración', () => {
    setAuth({ session: fakeSession, perfil: perfilNormal })
    renderUI(<Navbar />)
    expect(screen.getByText('Chat')).toBeInTheDocument()
    expect(screen.queryByText('Usuarios')).toBeNull()
  })
})

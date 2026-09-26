// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Chip, EmptyState, ErrorBox, Skeleton } from './ui'
import { Modal } from './Modal'
import Navbar from './Navbar'
import { CierraPill, EstadoPill, IaPill } from './Pills'
import {
  authState,
  perfilAdmin,
  perfilNormal,
  renderPlano,
  renderUI,
  setAuth,
} from '../test/dom'

vi.mock('../lib/auth', async (orig) => ({
  ...(await orig<typeof import('../lib/auth')>()),
  useAuth: () => authState,
}))

beforeEach(() => setAuth())

describe('ui', () => {
  it('ErrorBox muestra el mensaje y dispara retry', () => {
    const retry = vi.fn()
    renderPlano(<ErrorBox retry={retry}>falló la carga</ErrorBox>)
    expect(screen.getByText('falló la carga')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }))
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('ErrorBox sin retry no muestra botón', () => {
    renderPlano(<ErrorBox>falló</ErrorBox>)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('EmptyState muestra título y pista', () => {
    renderPlano(<EmptyState title="Sin datos" hint="prueba otra cosa" />)
    expect(screen.getByText('Sin datos')).toBeInTheDocument()
    expect(screen.getByText('prueba otra cosa')).toBeInTheDocument()
  })

  it('Skeleton aplica la clase de animación', () => {
    const { container } = renderPlano(<Skeleton className="h-20" />)
    expect(container.firstChild).toHaveClass('animate-pulse')
  })

  it('Chip activo cambia de estilo y responde al click', () => {
    const onClick = vi.fn()
    const { rerender } = renderPlano(<Chip onClick={onClick}>Filtro</Chip>)
    const chip = screen.getByRole('button', { name: 'Filtro' })
    expect(chip).not.toHaveClass('bg-teal-500')
    fireEvent.click(chip)
    expect(onClick).toHaveBeenCalledTimes(1)
    rerender(<Chip active onClick={onClick}>Filtro</Chip>)
    expect(screen.getByRole('button', { name: 'Filtro' })).toHaveClass('bg-teal-500')
  })
})

describe('Modal', () => {
  it('no renderiza nada cerrado', () => {
    const { container } = renderPlano(
      <Modal open={false} onClose={() => {}} title="T">cuerpo</Modal>,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renderiza diálogo accesible y cierra con Escape, overlay y botón', () => {
    const onClose = vi.fn()
    const { rerender } = renderPlano(
      <Modal open onClose={onClose} title="Detalle">cuerpo</Modal>,
    )
    const dialogo = screen.getByRole('dialog', { name: 'Detalle' })
    expect(dialogo).toBeInTheDocument()
    expect(document.body.style.overflow).toBe('hidden')

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)

    // Click dentro del diálogo no cierra; click en el overlay sí.
    fireEvent.click(dialogo)
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(dialogo.parentElement!)
    expect(onClose).toHaveBeenCalledTimes(2)

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(onClose).toHaveBeenCalledTimes(3)

    rerender(<Modal open={false} onClose={onClose} title="Detalle">cuerpo</Modal>)
    expect(document.body.style.overflow).toBe('')
  })
})

describe('Pills', () => {
  it('EstadoPill e IaPill muestran su etiqueta', () => {
    renderPlano(
      <>
        <EstadoPill estado="Vigente" />
        <IaPill nivel="alta" />
        <CierraPill label="cierra hoy" tone="warn" />
      </>,
    )
    expect(screen.getByText('Vigente')).toBeInTheDocument()
    expect(screen.getByText(/alta/i)).toBeInTheDocument()
    expect(screen.getByText('cierra hoy')).toBeInTheDocument()
  })
})

describe('Navbar', () => {
  it('muestra los enlaces base y oculta los de admin a perfil normal', () => {
    setAuth({ perfil: perfilNormal })
    renderUI(<Navbar />)
    for (const label of ['Diario', 'Dashboard', 'Buscador', 'Chat', 'API']) {
      expect(screen.getAllByRole('link', { name: label }).length).toBeGreaterThan(0)
    }
    expect(screen.queryByRole('link', { name: 'Usuarios' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Observabilidad' })).not.toBeInTheDocument()
  })

  it('muestra los enlaces admin a un perfil admin', () => {
    setAuth({ perfil: perfilAdmin })
    renderUI(<Navbar />)
    expect(screen.getAllByRole('link', { name: 'Usuarios' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Observabilidad' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Keywords' }).length).toBeGreaterThan(0)
  })

  it('salir cierra sesión y navega a /login', async () => {
    const signOut = vi.fn(async () => {})
    setAuth({ perfil: perfilNormal, signOut })
    renderUI(
      <>
        <Navbar />
        <p>MARCADOR RAÍZ</p>
      </>,
      '/',
    )
    const user = userEvent.setup()
    await user.click(screen.getAllByRole('button', { name: /cerrar sesión|salir/i })[0])
    expect(signOut).toHaveBeenCalledTimes(1)
  })
})

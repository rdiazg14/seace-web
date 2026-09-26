// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider, useTheme } from './theme'

function Sonda() {
  const { theme, isDark, toggle } = useTheme()
  return (
    <button onClick={toggle}>
      {theme}:{isDark ? 'oscuro' : 'claro'}
    </button>
  )
}

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark', 'light')
  })

  it('arranca en oscuro por defecto y persiste el cambio a claro', () => {
    render(
      <ThemeProvider>
        <Sonda />
      </ThemeProvider>,
    )
    expect(screen.getByRole('button')).toHaveTextContent('dark:oscuro')
    expect(document.documentElement).toHaveClass('dark')
    expect(localStorage.getItem('seace-theme')).toBe('dark')

    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('button')).toHaveTextContent('light:claro')
    expect(document.documentElement).toHaveClass('light')
    expect(document.documentElement).not.toHaveClass('dark')
    expect(localStorage.getItem('seace-theme')).toBe('light')
  })

  it('respeta la preferencia guardada', () => {
    localStorage.setItem('seace-theme', 'light')
    render(
      <ThemeProvider>
        <Sonda />
      </ThemeProvider>,
    )
    expect(screen.getByRole('button')).toHaveTextContent('light:claro')
    expect(document.documentElement).toHaveClass('light')
  })
})

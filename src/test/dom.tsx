/** Utilidades de renderizado para pruebas DOM (entorno jsdom, declarado por
 *  archivo con `// @vitest-environment jsdom`). Importar este módulo aplica los
 *  stubs de APIs del navegador que jsdom no implementa y registra jest-dom. */
import '@testing-library/jest-dom/vitest'
import { render } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import type { Session } from '@supabase/supabase-js'
import { ThemeProvider } from '../lib/theme'
import type { Perfil } from '../types'

if (typeof window !== 'undefined') {
  if (!('ResizeObserver' in globalThis)) {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {}
  }
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
  // Sin red en pruebas: los fetch a Supabase/AI_PROXY resuelven vacío salvo que
  // el test sobreescriba el mock.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response('{}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  )
}

export interface FakeAuth {
  session: Session | null
  perfil: Perfil | null
  loading: boolean
  signOut: () => Promise<void>
}

/** Estado leído por el `useAuth` simulado. Restablecer con `setAuth()`. */
export const authState: FakeAuth = {
  session: null,
  perfil: null,
  loading: false,
  signOut: async () => {},
}

export function setAuth(parcial: Partial<FakeAuth> = {}) {
  Object.assign(authState, {
    session: null,
    perfil: null,
    loading: false,
    signOut: async () => {},
    ...parcial,
  })
}

export const fakeSession = {
  user: { id: 'user-1', email: 'ana@seace.test' },
  access_token: 'token-fake',
} as unknown as Session

export const perfilNormal: Perfil = {
  id: 'user-1',
  email: 'ana@seace.test',
  rol: 'normal',
  creado_por: null,
  created_at: '2026-01-01T00:00:00Z',
}

export const perfilAdmin: Perfil = { ...perfilNormal, rol: 'admin' }

export function renderUI(
  ui: ReactElement,
  ruta: string | { ruta: string; estado?: unknown } = '/',
) {
  const entrada =
    typeof ruta === 'string' ? ruta : { pathname: ruta.ruta, state: ruta.estado }
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[entrada]}>{ui}</MemoryRouter>
    </ThemeProvider>,
  )
}

export function renderPlano(ui: ReactNode) {
  return render(<ThemeProvider>{ui}</ThemeProvider>)
}

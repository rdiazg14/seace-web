// @vitest-environment jsdom
import '../test/dom'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { AuthProvider, useAuth } from './auth'
import { RequireAuth } from '../components/RequireAuth'

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), from: vi.fn(), subscribe: vi.fn() }))
vi.mock('./supabase', () => ({ supabase: {
  auth: { getSession: mocks.getSession, onAuthStateChange: mocks.subscribe, signOut: vi.fn() },
  from: mocks.from,
} }))

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => { resolve = r })
  return { promise, resolve }
}
const session = (id: string) => ({ user: { id } }) as Session
const profile = (id: string) => ({ id, email: 'test@example.test', rol: 'normal', creado_por: null, created_at: '' })
let notify: (event: AuthChangeEvent, next: Session | null) => void
function State() {
  const a = useAuth()
  return <><output data-testid="state">{JSON.stringify({ uid: a.session?.user.id, pid: a.perfil?.id, loading: a.loading, error: a.perfilError })}</output><button onClick={a.retryPerfil}>retry</button></>
}
function Protected() {
  const { session: current } = useAuth()
  return current ? <RequireAuth><p>Contenido protegido</p></RequireAuth> : null
}
function mount() {
  return render(<MemoryRouter><AuthProvider><State /><Protected /></AuthProvider></MemoryRouter>)
}
function query(result: Promise<unknown>) {
  const builder = { select: () => builder, eq: () => builder, abortSignal: () => builder, maybeSingle: () => result }
  return builder
}
const state = () => JSON.parse(screen.getByTestId('state').textContent!)
beforeEach(() => {
  vi.resetAllMocks()
  mocks.getSession.mockResolvedValue({ data: { session: null } })
  mocks.subscribe.mockImplementation((callback) => {
    notify = callback
    return { data: { subscription: { unsubscribe: vi.fn() } } }
  })
})
afterEach(cleanup)

describe('AuthProvider y perfil al iniciar sesion', () => {
  it('espera el perfil al iniciar sesion sin mostrar ausencia ni consultar dentro del callback', async () => {
    const p = deferred<unknown>()
    mocks.from.mockReturnValue(query(p.promise))
    mount()
    await waitFor(() => expect(state().loading).toBe(false))
    act(() => notify('SIGNED_IN', session('a')))
    expect(state().loading).toBe(true)
    expect(screen.queryByText(/perfil habilitado/)).not.toBeInTheDocument()
    expect(mocks.from).not.toHaveBeenCalled()
    await waitFor(() => expect(mocks.from).toHaveBeenCalledTimes(1))
    await act(async () => p.resolve({ data: profile('a'), error: null }))
    expect(screen.getByText('Contenido protegido')).toBeInTheDocument()
  })
  it('un perfil atrasado no restaura permisos despues de salir', async () => {
    const p = deferred<unknown>()
    mocks.from.mockReturnValue(query(p.promise))
    mount()
    act(() => notify('SIGNED_IN', session('a')))
    await waitFor(() => expect(mocks.from).toHaveBeenCalled())
    act(() => notify('SIGNED_OUT', null))
    await act(async () => p.resolve({ data: profile('a'), error: null }))
    expect(state()).toMatchObject({ loading: false })
    expect(state().pid).toBeUndefined()
    expect(state().uid).toBeUndefined()
  })
  it('la ultima cuenta prevalece ante consultas concurrentes', async () => {
    const a = deferred<unknown>(), b = deferred<unknown>()
    mocks.from.mockReturnValueOnce(query(a.promise)).mockReturnValueOnce(query(b.promise))
    mount()
    act(() => notify('SIGNED_IN', session('a')))
    await waitFor(() => expect(mocks.from).toHaveBeenCalledTimes(1))
    act(() => notify('SIGNED_IN', session('b')))
    await waitFor(() => expect(mocks.from).toHaveBeenCalledTimes(2))
    await act(async () => b.resolve({ data: profile('b'), error: null }))
    await act(async () => a.resolve({ data: profile('a'), error: null }))
    expect(state()).toMatchObject({ uid: 'b', pid: 'b', loading: false })
  })
  it('getSession atrasado no sobrescribe un evento nuevo', async () => {
    const initial = deferred<unknown>()
    mocks.getSession.mockReturnValue(initial.promise)
    mocks.from.mockReturnValue(query(Promise.resolve({ data: profile('b'), error: null })))
    mount()
    act(() => notify('SIGNED_IN', session('b')))
    await waitFor(() => expect(state().pid).toBe('b'))
    await act(async () => initial.resolve({ data: { session: null } }))
    expect(state().uid).toBe('b')
  })
  it('error de consulta se distingue de ausencia y permite reintentar', async () => {
    mocks.from.mockReturnValueOnce(query(Promise.resolve({ data: null, error: { message: 'private' } })))
      .mockReturnValueOnce(query(Promise.resolve({ data: profile('a'), error: null })))
    mount()
    act(() => notify('SIGNED_IN', session('a')))
    await screen.findByText(/No pudimos cargar tu perfil/, { selector: 'p' })
    expect(screen.queryByText(/perfil habilitado/)).not.toBeInTheDocument()
    act(() => screen.getByText('Reintentar').click())
    await screen.findByText('Contenido protegido')
  })
  it('ausencia real mantiene cerrado el contenido y refresh no repite la consulta', async () => {
    mocks.from.mockReturnValue(query(Promise.resolve({ data: null, error: null })))
    mount()
    act(() => notify('SIGNED_IN', session('a')))
    await screen.findByText(/perfil habilitado/)
    act(() => notify('TOKEN_REFRESHED', session('a')))
    act(() => notify('SIGNED_IN', session('a')))
    expect(mocks.from).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Contenido protegido')).not.toBeInTheDocument()
  })
})

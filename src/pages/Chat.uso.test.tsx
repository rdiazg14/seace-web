// @vitest-environment jsdom
/** Chat con hook real y Supabase simulado: al abrir una conversación guardada,
 *  el total mostrado sale de `uso_ia` (servidor) y no de lo que guardó el navegador. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Chat from './Chat'
import { resetSupabaseFakes, setTableData } from '../test/fakeSupabase'
import { authState, fakeSession, perfilNormal, renderUI, setAuth } from '../test/dom'

vi.mock('../lib/auth', () => ({ useAuth: () => authState }))
vi.mock('../lib/supabase', () => import('../test/fakeSupabase'))

const SESION = { id: 's1', titulo: 'Laptops MINSA', tokens_prompt: 999999, tokens_completion: 999999, n_mensajes: 2, updated_at: '2026-10-09T10:00:00Z', contrato_id: null }
const MENSAJES = [
  { id: 1, rol: 'user', texto: '¿qué laptops hay?', refs: null, tokens_prompt: 0, tokens_completion: 0, error: false, limit_flag: false, payload: null },
  { id: 2, rol: 'bot', texto: 'Hay dos contratos', refs: null, tokens_prompt: 999999, tokens_completion: 999999, error: false, limit_flag: false, payload: { request_id: 'req-00000001' } },
]

beforeEach(() => {
  resetSupabaseFakes()
  setAuth({ session: fakeSession, perfil: perfilNormal })
  setTableData('chat_sesiones', [SESION])
  setTableData('chat_mensajes', MENSAJES)
})

async function abrirHistorial() {
  renderUI(<Chat />, '/chat')
  await userEvent.click(await screen.findByRole('button', { name: 'Historial (1)' }))
}

async function abrir() {
  await abrirHistorial()
  await userEvent.click(await screen.findByText('Laptops MINSA'))
  expect(await screen.findByText('Hay dos contratos')).toBeInTheDocument()
}

describe('Chat: total de tokens de una conversación guardada', () => {
  it('con registro del servidor muestra el uso verificado, no el declarado', async () => {
    setTableData('uso_ia', [{
      request_id: 'req-00000001', modelo: 'qwen3.7-flash', tokens_prompt: 100, tokens_completion: 20,
      tokens_thoughts: 0, tokens_cached: 0, costo_usd: 0.00015, latencia_ms: 900, resultado: 'ok',
    }])
    await abrir()
    expect(screen.getByText('Tokens: 120')).toBeInTheDocument()
    expect(screen.queryByText(/1,999,998/)).toBeNull()
  })

  it('sin registro del servidor el total se presenta como estimado', async () => {
    setTableData('uso_ia', [])
    await abrir()
    expect(screen.getByText(/Tokens: ≈ 1,999,998/)).toBeInTheDocument()
    expect(screen.getByText('(estimado)')).toBeInTheDocument()
  })

  it('la lista de conversaciones rotula su cifra como estimación del navegador', async () => {
    await abrirHistorial()
    expect(await screen.findByText(/≈ 1,999,998 tokens/)).toBeInTheDocument()
  })
})

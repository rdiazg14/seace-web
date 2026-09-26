/** POST /cotizar del asistente del contrato (JSON o SSE según la respuesta). */

import { AI_PROXY } from '../../../lib/supabase'
import { workerAuthHeaders } from '../../../lib/workerAuth'

export async function consultarCotizar(body: {
  contrato_id: number
  query: string
  history: { role: 'user' | 'bot'; text: string }[]
  model: string
  use_web: boolean
}): Promise<Response> {
  const headers = await workerAuthHeaders({
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    ...(body.contrato_id ? { 'X-Contrato-Id': String(body.contrato_id) } : {}),
  })
  return fetch(`${AI_PROXY}/cotizar`, { method: 'POST', headers, body: JSON.stringify(body) })
}

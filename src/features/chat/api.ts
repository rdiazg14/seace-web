/** Acceso a red del chat general: proxy RAG (POST /) y fichas de contratos citados. */

import { AI_PROXY, supabase } from '../../lib/supabase'
import { workerAuthHeaders } from '../../lib/workerAuth'
import type { Contrato, ContratoRef } from '../../types'

export async function consultarChat(
  body: { query: string; history: { role: 'user' | 'bot'; text: string }[]; use_web: boolean },
  signal: AbortSignal,
): Promise<Response> {
  const headers = await workerAuthHeaders({
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  })
  return fetch(AI_PROXY, { method: 'POST', headers, body: JSON.stringify(body), signal })
}

/** Fichas completas de los contratos citados, en el orden de las citas. */
export async function cargarContratosCitados(refs: ContratoRef[]): Promise<Contrato[]> {
  if (!refs.length) return []
  const ids = refs.map(r => r.id)
  const { data: rows } = await supabase.from('v_contratos').select('*').in('id', ids)
  const byId = new Map(((rows ?? []) as Contrato[]).map(c => [c.id, c]))
  return ids.map(id => byId.get(id)).filter((c): c is Contrato => Boolean(c))
}

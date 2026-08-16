import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AI_PROXY, supabase } from '../lib/supabase'
import type { Contrato, ContratoRef } from '../types'
import ContratoCard from '../components/ContratoCard'

const SUGERENCIAS = [
  'Contratos de ciberseguridad vigentes',
  'Equipos de cómputo con specs',
  'Qué compra el Ministerio de Trabajo',
  'Cloud o servicios en la nube',
]

interface Msg {
  role: 'user' | 'bot'
  text: string
  contratos?: Contrato[]
  error?: boolean
  stage?: string
  query?: string
}

function RichText({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {lines.map((line, i) => {
        const parts = line.split(/(\*\*[^*]+\*\*)/g)
        const nodes = parts.map((p, j) =>
          p.startsWith('**') && p.endsWith('**')
            ? <strong key={j} className="font-medium">{p.slice(2, -2)}</strong>
            : <span key={j}>{p}</span>,
        )
        const t = line.trim()
        if (t.startsWith('- ') || t.startsWith('* ') || /^\d+\.\s/.test(t)) {
          return <div key={i} className="flex gap-2 pl-1"><span className="text-teal-500">•</span><span>{nodes}</span></div>
        }
        return <p key={i}>{nodes}</p>
      })}
    </div>
  )
}

async function loadContratos(refs: ContratoRef[]): Promise<Contrato[]> {
  if (!refs.length) return []
  const ids = refs.map(r => r.id)
  const { data: rows } = await supabase.from('contratos').select('*').in('id', ids)
  const byId = new Map(((rows ?? []) as Contrato[]).map(c => [c.id, c]))
  return ids.map(id => byId.get(id)).filter((c): c is Contrato => Boolean(c))
}

function parseSseBlock(block: string): unknown | null {
  const line = block.split('\n').find(l => l.startsWith('data:'))
  if (!line) return null
  const payload = line.slice(5).trim()
  if (!payload || payload === '[DONE]') return null
  try {
    return JSON.parse(payload)
  } catch {
    return null
  }
}

export default function Chat() {
  const navigate = useNavigate()
  const [messages, setMessages] = useState<Msg[]>([{
    role: 'bot',
    text: 'Soy el asistente SEACE con IA. Busco en los Términos de Referencia reales de 2,330 contratos vigentes. Pregúntame sobre requisitos técnicos, especificaciones, plazos o cualquier detalle.',
  }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  function patchLast(partial: Partial<Msg>) {
    setMessages(m => {
      const next = [...m]
      const last = next[next.length - 1]
      if (last?.role === 'bot') next[next.length - 1] = { ...last, ...partial }
      return next
    })
  }

  async function consumeJson(res: Response, query: string) {
    const data = await res.json() as {
      respuesta?: string
      response?: string
      contratos_referenciados?: ContratoRef[]
      error?: string
    }
    const contratos = await loadContratos(data.contratos_referenciados ?? [])
    patchLast({
      text: data.respuesta || data.response || 'No pude generar una respuesta.',
      contratos,
      error: Boolean(data.error),
      stage: undefined,
      query,
    })
  }

  async function consumeSse(res: Response, query: string) {
    const reader = res.body?.getReader()
    if (!reader) throw new Error('sin stream')
    const decoder = new TextDecoder()
    let buf = ''
    let text = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const parts = buf.split('\n\n')
      buf = parts.pop() ?? ''
      for (const part of parts) {
        const ev = parseSseBlock(part) as {
          stage?: string
          message?: string
          token?: string
          chunks?: number
          contratos_referenciados?: ContratoRef[]
        } | null
        if (!ev) continue
        if (ev.stage === 'searching' || ev.stage === 'found') {
          patchLast({ stage: ev.message || ev.stage, query })
        } else if (ev.stage === 'streaming' && ev.token) {
          text += ev.token
          patchLast({ text, stage: 'Generando…', query })
        } else if (ev.stage === 'done') {
          const contratos = await loadContratos(ev.contratos_referenciados ?? [])
          patchLast({ text, contratos, stage: undefined, query })
        } else if (ev.stage === 'error') {
          throw new Error(ev.message || 'error SSE')
        }
      }
    }
  }

  async function enviar(texto = input) {
    const q = texto.trim()
    if (!q || loading) return
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setInput('')
    setMessages(m => [
      ...m,
      { role: 'user', text: q },
      { role: 'bot', text: '', stage: 'Buscando en 9,074 fragmentos…', query: q },
    ])
    setLoading(true)
    try {
      const res = await fetch(AI_PROXY, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({ query: q }),
        signal: ac.signal,
      })
      if (!res.ok) {
        let msg = `No pude consultar la IA ahora (HTTP ${res.status}).`
        try {
          const data = await res.json() as { respuesta?: string; response?: string; error?: string }
          msg = data.respuesta || data.response || data.error || msg
        } catch { /* cuerpo no JSON */ }
        patchLast({ text: msg, error: true, stage: undefined, query: q })
        return
      }
      const ct = res.headers.get('content-type') || ''
      if (ct.includes('text/event-stream') && res.body) {
        await consumeSse(res, q)
      } else {
        await consumeJson(res, q)
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        patchLast({
          text: 'La conexión se interrumpió. Puedes reintentar la misma pregunta.',
          error: true,
          stage: undefined,
          query: q,
        })
      } else {
        patchLast({
          text: 'No pude consultar la IA ahora. Prueba de nuevo o usa el buscador.',
          error: true,
          stage: undefined,
          query: q,
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const last = messages[messages.length - 1]
  const streaming = loading && last?.role === 'bot'

  return (
    <div className="mx-auto flex h-[calc(100dvh-3.5rem)] max-w-[800px] flex-col px-3 sm:px-4">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[92%] sm:max-w-[85%] ${m.role === 'user' ? '' : 'w-full'}`}>
              {m.role === 'bot' && <p className="mb-1 text-[11px] font-medium text-teal-600 dark:text-teal-400">SEACE Bot</p>}
              <div className={`rounded-2xl px-3.5 py-2.5 ${
                m.role === 'user'
                  ? 'rounded-br-sm bg-teal-500 text-white'
                  : m.error
                    ? 'rounded-bl-sm border border-red-500/30 bg-red-500/10'
                    : 'rounded-bl-sm border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
              }`}
              >
                {m.role === 'bot' && m.stage && (
                  <p className="mb-1.5 text-xs text-teal-600 dark:text-teal-400">{m.stage}</p>
                )}
                {m.role === 'bot'
                  ? (m.text ? <RichText text={m.text} /> : streaming && i === messages.length - 1 ? <span className="inline-block h-3 w-1.5 animate-pulse bg-teal-500" /> : null)
                  : <p className="text-sm">{m.text}</p>}
              </div>
              {m.contratos && m.contratos.length > 0 && (
                <div className="mt-2 space-y-2">
                  {m.contratos.map(c => (
                    <ContratoCard
                      key={c.id}
                      c={c}
                      compact
                      onSimilares={() => navigate(`/buscar?q=${encodeURIComponent((c.categoria_it || c.descripcion || '').slice(0, 80))}`)}
                    />
                  ))}
                </div>
              )}
              {m.role === 'bot' && m.error && (
                <div className="mt-2 flex gap-3">
                  {m.query && (
                    <button
                      type="button"
                      onClick={() => void enviar(m.query)}
                      className="text-xs font-medium text-teal-600 dark:text-teal-400"
                    >
                      Reintentar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate('/buscar')}
                    className="text-xs font-medium text-slate-500"
                  >
                    Ir al buscador
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {messages.length === 1 && !loading && (
        <div className="flex flex-wrap gap-2 pb-3">
          {SUGERENCIAS.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => void enviar(s)}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:border-teal-400 dark:border-slate-700 dark:text-slate-300"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        className="flex gap-2 pb-4 pt-1"
        onSubmit={e => { e.preventDefault(); void enviar() }}
      >
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={loading}
          placeholder="Pregunta sobre TDR, specs, plazos…"
          className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900"
        />
        {loading ? (
          <button
            type="button"
            onClick={() => abortRef.current?.abort()}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium dark:border-slate-600"
          >
            Detener
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            Enviar
          </button>
        )}
      </form>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AI_PROXY, supabase } from '../lib/supabase'
import type { Contrato, ContratoRef } from '../types'
import { EstadoPill } from '../components/Pills'

const SUGERENCIAS = [
  'ciberseguridad',
  'servicios contables',
  'equipos de cómputo',
  'cloud o servicios en la nube',
]

interface Msg {
  role: 'user' | 'bot'
  text: string
  refs?: ContratoRef[]
  contratos?: Contrato[]
  error?: boolean
  limit?: boolean
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

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden>
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-500 [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-500 [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-500" />
    </span>
  )
}

function CitaFuente({
  cita,
  contrato,
  onSimilares,
}: {
  cita: ContratoRef
  contrato?: Contrato
  onSimilares?: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[11px] font-medium text-teal-700 dark:text-teal-400">{cita.nro}</p>
        <p className="truncate text-xs text-slate-600 dark:text-slate-300">{cita.entidad || 'Entidad no indicada'}</p>
      </div>
      {cita.estado && <EstadoPill estado={cita.estado} />}
      {cita.fuente === 'pdf' && (
        <span className="rounded-full bg-teal-500/15 px-2 py-0.5 text-[11px] font-medium text-teal-700 dark:text-teal-300">
          incluye TDR
        </span>
      )}
      <a
        href={cita.url}
        target="_blank"
        rel="noreferrer"
        className="shrink-0 rounded-lg bg-teal-500 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-teal-400"
      >
        Ver en SEACE
      </a>
      {onSimilares && contrato && (
        <button
          type="button"
          onClick={onSimilares}
          className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-teal-400 dark:border-slate-700 dark:text-slate-300"
        >
          Similares
        </button>
      )}
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

const HISTORY_MAX_ITEMS = 8
const HISTORY_MAX_CHARS = 500

/** Últimos 4 pares para el Worker. El embed/RAG solo ven `query`; el history no resuelve "ese contrato". */
function buildChatHistory(messages: Msg[]): { role: 'user' | 'bot'; text: string }[] {
  const out: { role: 'user' | 'bot'; text: string }[] = []
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i]
    if (i === 0 && m.role === 'bot') continue
    if (m.error || m.limit) continue
    if (m.role === 'bot' && !m.text.trim()) continue
    out.push({ role: m.role, text: m.text.slice(0, HISTORY_MAX_CHARS) })
  }
  return out.slice(-HISTORY_MAX_ITEMS)
}

function mensajeLimite(status: number, data: { respuesta?: string; response?: string; error?: string }): string {
  const fromWorker = data.respuesta || data.response
  if (fromWorker) return fromWorker
  if (status === 429 || data.error === 'rate_limited') {
    return 'Has hecho demasiadas consultas. Espera un minuto e intenta de nuevo.'
  }
  if (data.error === 'daily_limited') {
    return 'Llegaste al límite diario de consultas desde esta red. Intenta mañana.'
  }
  if (status === 503 || data.error === 'over_capacity') {
    return 'Hay alta demanda en el asistente. Intenta más tarde.'
  }
  return 'No pude consultar la IA ahora. Prueba de nuevo o usa el buscador.'
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
    const refs = data.contratos_referenciados ?? []
    const contratos = await loadContratos(refs)
    patchLast({
      text: data.respuesta || data.response || 'No pude generar una respuesta.',
      refs,
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
        if (ev.stage === 'searching') {
          patchLast({ stage: ev.message || 'Buscando en los TDR…', query })
        } else if (ev.stage === 'found') {
          patchLast({
            stage: ev.message || (ev.chunks != null
              ? `Encontré ${ev.chunks} fragmentos relevantes`
              : 'Encontré fragmentos relevantes'),
            query,
          })
        } else if (ev.stage === 'streaming' && ev.token) {
          text += ev.token
          patchLast({ text, stage: 'Redactando la respuesta…', query })
        } else if (ev.stage === 'done') {
          const refs = ev.contratos_referenciados ?? []
          const contratos = await loadContratos(refs)
          patchLast({ text, refs, contratos, stage: undefined, query })
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
    const history = buildChatHistory(messages)
    setInput('')
    setMessages(m => [
      ...m,
      { role: 'user', text: q },
      { role: 'bot', text: '', stage: 'Buscando en los TDR…', query: q },
    ])
    setLoading(true)
    try {
      const res = await fetch(AI_PROXY, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({ query: q, history }),
        signal: ac.signal,
      })
      if (!res.ok) {
        let data: { respuesta?: string; response?: string; error?: string } = {}
        try {
          data = await res.json() as { respuesta?: string; response?: string; error?: string }
        } catch { /* cuerpo no JSON */ }
        const isLimit = res.status === 429 || res.status === 503
          || data.error === 'rate_limited'
          || data.error === 'daily_limited'
          || data.error === 'over_capacity'
        patchLast({
          text: mensajeLimite(res.status, data),
          error: !isLimit,
          limit: isLimit,
          stage: undefined,
          query: q,
        })
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
  const showWelcomeChips = messages.length === 1 && !loading
  const showInlineChips = messages.length > 1 && !loading

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
                  : m.limit
                    ? 'rounded-bl-sm border border-amber-500/40 bg-amber-500/10'
                    : m.error
                      ? 'rounded-bl-sm border border-red-500/30 bg-red-500/10'
                      : 'rounded-bl-sm border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
              }`}
              >
                {m.role === 'bot' && m.stage && (
                  <p className="mb-1.5 flex items-center gap-2 text-xs text-teal-600 dark:text-teal-400">
                    <TypingDots />
                    <span>{m.stage}</span>
                  </p>
                )}
                {m.role === 'bot'
                  ? (m.text
                    ? <RichText text={m.text} />
                    : streaming && i === messages.length - 1
                      ? <p className="text-xs text-slate-500">Esto puede tardar unos 10 segundos…</p>
                      : null)
                  : <p className="text-sm">{m.text}</p>}
              </div>
              {m.refs && m.refs.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  <p className="text-[11px] font-medium text-slate-500">Contratos citados</p>
                  {m.refs.map(cita => {
                    const contrato = m.contratos?.find(c => c.id === cita.id)
                    return (
                      <CitaFuente
                        key={cita.id}
                        cita={cita}
                        contrato={contrato}
                        onSimilares={contrato
                          ? () => navigate(`/buscar?q=${encodeURIComponent((contrato.categoria_it || contrato.descripcion || '').slice(0, 80))}`)
                          : undefined}
                      />
                    )
                  })}
                </div>
              )}
              {m.role === 'bot' && (m.error || m.limit) && (
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

      {(showWelcomeChips || showInlineChips) && (
        <div className="flex flex-wrap items-center gap-2 pb-3">
          {showInlineChips && (
            <span className="text-[11px] text-slate-400">Ejemplos</span>
          )}
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

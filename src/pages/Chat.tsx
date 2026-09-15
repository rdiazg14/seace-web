import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AI_PROXY, supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { workerAuthHeaders } from '../lib/workerAuth'
import {
  actualizarSesion,
  borrarSesion,
  cargarMensajes,
  crearSesion,
  guardarMensaje,
  listarSesiones,
  type SesionChat,
} from '../lib/chatSesiones'
import type { Contrato, ContratoRef } from '../types'
import { EstadoPill } from '../components/Pills'
import { MarkdownRenderer } from '../components/MarkdownRenderer'

const SUGERENCIAS = [
  'ciberseguridad',
  'servicios contables',
  'equipos de cómputo',
  'cloud o servicios en la nube',
]

const BIENVENIDA =
  'Soy el asistente SEACE con IA. Busco en los Términos de Referencia reales de los contratos vigentes. Pregúntame sobre requisitos técnicos, especificaciones, plazos o cualquier detalle.'

const CONTEXTO_LIMITE = 1_000_000

interface Uso {
  prompt: number
  completion: number
}

interface Msg {
  role: 'user' | 'bot'
  text: string
  refs?: ContratoRef[]
  contratos?: Contrato[]
  error?: boolean
  limit?: boolean
  stage?: string
  query?: string
  tokens_prompt?: number
  tokens_completion?: number
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
  const { data: rows } = await supabase.from('v_contratos').select('*').in('id', ids)
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
  for (const m of messages) {
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
  if (status === 502) {
    return 'El servicio no respondió correctamente. Podés reintentar la misma pregunta.'
  }
  return 'No pude consultar la IA ahora. Prueba de nuevo o usa el buscador.'
}

function composeRagPrefill(q: string, nro: string, titulo: string, cat: string | null): string {
  let ctx = nro ? `${nro} — ${titulo}` : titulo
  if (cat) ctx += ` · ${cat}`
  return ctx ? `[Contexto: ${ctx}] ${q}` : q
}

function hace(iso: string): string {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ''
  const diff = Date.now() - t
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.floor(h / 24)
  return `hace ${d} d`
}

export default function Chat() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const prefillApplied = useRef(false)
  const [prefillNro, setPrefillNro] = useState<string | null>(null)

  const [messages, setMessages] = useState<Msg[]>([])
  const [sesiones, setSesiones] = useState<SesionChat[]>([])
  const [sesionId, setSesionId] = useState<string | null>(null)
  const [totales, setTotales] = useState<Uso>({ prompt: 0, completion: 0 })
  const [historialAbierto, setHistorialAbierto] = useState(false)
  const [cargandoSesion, setCargandoSesion] = useState(false)

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const userId = session?.user?.id ?? null

  async function refrescarSesiones() {
    if (!userId) return
    try {
      setSesiones(await listarSesiones(userId))
    } catch (e) {
      console.error('listar sesiones', e)
    }
  }

  useEffect(() => {
    void refrescarSesiones()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  useEffect(() => {
    if (prefillApplied.current) return
    const q = searchParams.get('q')?.trim()
    if (!q) return
    prefillApplied.current = true
    const nro = searchParams.get('nro')?.trim() || ''
    const titulo = searchParams.get('titulo')?.trim() || ''
    const cat = searchParams.get('cat')?.trim() || null
    setInput(composeRagPrefill(q, nro, titulo, cat))
    if (nro) setPrefillNro(nro)
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

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

  async function abrirSesion(s: SesionChat) {
    setCargandoSesion(true)
    setSesionId(s.id)
    setTotales({ prompt: s.tokens_prompt, completion: s.tokens_completion })
    setHistorialAbierto(false)
    setInput('')
    try {
      const rows = await cargarMensajes(s.id)
      const msgs: Msg[] = []
      for (const m of rows) {
        const refs = m.refs ?? undefined
        const contratos = refs?.length ? await loadContratos(refs) : undefined
        msgs.push({
          role: m.rol,
          text: m.texto,
          refs,
          contratos,
          error: m.error,
          limit: m.limit_flag,
          tokens_prompt: m.tokens_prompt,
          tokens_completion: m.tokens_completion,
        })
      }
      setMessages(msgs)
    } catch (e) {
      console.error('abrir sesion', e)
    } finally {
      setCargandoSesion(false)
    }
  }

  function nuevaConversacion() {
    abortRef.current?.abort()
    setSesionId(null)
    setMessages([])
    setTotales({ prompt: 0, completion: 0 })
    setHistorialAbierto(false)
    setInput('')
  }

  async function eliminarSesion(s: SesionChat) {
    try {
      await borrarSesion(s.id)
      if (s.id === sesionId) nuevaConversacion()
      await refrescarSesiones()
    } catch (e) {
      console.error('borrar sesion', e)
    }
  }

  async function consumeJson(res: Response, query: string): Promise<Msg> {
    const data = await res.json() as {
      respuesta?: string
      response?: string
      contratos_referenciados?: ContratoRef[]
      usage?: Uso
      error?: string
    }
    const refs = data.contratos_referenciados ?? []
    const contratos = await loadContratos(refs)
    const msg: Msg = {
      role: 'bot',
      text: data.respuesta || data.response || 'No pude generar una respuesta.',
      refs,
      contratos,
      error: Boolean(data.error),
      query,
      tokens_prompt: data.usage?.prompt ?? 0,
      tokens_completion: data.usage?.completion ?? 0,
    }
    patchLast(msg)
    return msg
  }

  async function consumeSse(res: Response, query: string): Promise<Msg> {
    const reader = res.body?.getReader()
    if (!reader) throw new Error('sin stream')
    const decoder = new TextDecoder()
    let buf = ''
    let text = ''
    let finalRefs: ContratoRef[] = []
    let usage: Uso = { prompt: 0, completion: 0 }
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
          usage?: Uso
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
          finalRefs = ev.contratos_referenciados ?? []
          usage = ev.usage ?? { prompt: 0, completion: 0 }
        } else if (ev.stage === 'error') {
          throw new Error(ev.message || 'error SSE')
        }
      }
    }
    const contratos = await loadContratos(finalRefs)
    const msg: Msg = {
      role: 'bot',
      text: text.trim() ? text : 'No pude generar una respuesta.',
      refs: finalRefs,
      contratos,
      query,
      tokens_prompt: usage.prompt,
      tokens_completion: usage.completion,
    }
    patchLast(msg)
    return msg
  }

  async function enviar(texto = input) {
    const q = texto.trim()
    if (!q || loading || !userId) return
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    const history = buildChatHistory(messages)

    // Asegura sesión (se crea en el primer envío, con el título = pregunta).
    let sid = sesionId
    if (!sid) {
      try {
        const s = await crearSesion(userId, q.slice(0, 40))
        sid = s.id
        setSesionId(s.id)
        setTotales({ prompt: 0, completion: 0 })
      } catch (e) {
        console.error('crear sesion', e)
      }
    }

    setInput('')
    setMessages(m => [
      ...m,
      { role: 'user', text: q },
      { role: 'bot', text: '', stage: 'Buscando en los TDR…', query: q },
    ])
    setLoading(true)

    if (sid) {
      guardarMensaje({ sesion_id: sid, user_id: userId, rol: 'user', texto: q })
        .catch(e => console.error('guardar user', e))
    }

    let bot: Msg | null = null
    try {
      const headers = await workerAuthHeaders({
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      })
      const res = await fetch(AI_PROXY, {
        method: 'POST',
        headers,
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
        bot = {
          role: 'bot',
          text: mensajeLimite(res.status, data),
          error: !isLimit,
          limit: isLimit,
          query: q,
        }
        patchLast(bot)
      } else {
        const ct = res.headers.get('content-type') || ''
        if (ct.includes('text/event-stream') && res.body) {
          bot = await consumeSse(res, q)
        } else {
          bot = await consumeJson(res, q)
        }
      }
    } catch (err) {
      const abortado = (err as Error).name === 'AbortError'
      bot = {
        role: 'bot',
        text: abortado
          ? 'La conexión se interrumpió. Puedes reintentar la misma pregunta.'
          : 'No pude consultar la IA ahora. Prueba de nuevo o usa el buscador.',
        error: true,
        query: q,
      }
      patchLast(bot)
    } finally {
      setLoading(false)
    }

    if (sid && bot) {
      const np = totales.prompt + (bot.tokens_prompt ?? 0)
      const nc = totales.completion + (bot.tokens_completion ?? 0)
      const n = messages.length + 2
      try {
        await guardarMensaje({
          sesion_id: sid,
          user_id: userId,
          rol: 'bot',
          texto: bot.text,
          refs: bot.refs ?? null,
          tokens_prompt: bot.tokens_prompt ?? 0,
          tokens_completion: bot.tokens_completion ?? 0,
          error: bot.error ?? false,
          limit_flag: bot.limit ?? false,
        })
        setTotales({ prompt: np, completion: nc })
        await actualizarSesion(sid, {
          tokens_prompt: np,
          tokens_completion: nc,
          n_mensajes: n,
        })
        void refrescarSesiones()
      } catch (e) {
        console.error('guardar bot', e)
      }
    }
  }

  const last = messages[messages.length - 1]
  const streaming = loading && last?.role === 'bot'
  const totalTokens = totales.prompt + totales.completion
  const lastPrompt = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const tp = messages[i].tokens_prompt
      if (tp) return tp
    }
    return 0
  }, [messages])
  const contextoPct = lastPrompt
    ? Math.min(100, Math.round((lastPrompt / CONTEXTO_LIMITE) * 1000) / 10)
    : 0

  return (
    <div className="mx-auto flex h-[calc(100dvh-3.5rem)] max-w-[800px] flex-col px-3 sm:px-4">
      {/* Barra superior: nueva conversación + uso */}
      <div className="flex items-center gap-2 border-b border-[var(--border)] py-2">
        <button
          type="button"
          onClick={nuevaConversacion}
          className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:border-teal-500"
        >
          + Nueva conversación
        </button>
        <button
          type="button"
          onClick={() => setHistorialAbierto(v => !v)}
          className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:border-teal-500"
        >
          Historial ({sesiones.length})
        </button>
        <div className="ml-auto flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
          <span className="rounded-full border border-[var(--border)] px-2 py-0.5">
            Tokens: {totalTokens.toLocaleString('es-PE')}
          </span>
          <span className="hidden rounded-full border border-[var(--border)] px-2 py-0.5 sm:inline">
            Contexto: {lastPrompt.toLocaleString('es-PE')} / 1M ({contextoPct}%)
          </span>
        </div>
      </div>

      {/* Panel de historial */}
      {historialAbierto && (
        <div className="max-h-64 overflow-y-auto border-b border-[var(--border)] py-2">
          {sesiones.length === 0 && (
            <p className="px-1 py-2 text-xs text-[var(--text-secondary)]">Todavía no hay conversaciones guardadas.</p>
          )}
          <ul className="space-y-1">
            {sesiones.map(s => (
              <li
                key={s.id}
                className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 ${
                  s.id === sesionId ? 'bg-teal-500/10' : 'hover:bg-[var(--bg-card)]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => void abrirSesion(s)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate text-sm text-[var(--text-primary)]">{s.titulo}</p>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    {s.n_mensajes} msgs · {(s.tokens_prompt + s.tokens_completion).toLocaleString('es-PE')} tokens · {hace(s.updated_at)}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => void eliminarSesion(s)}
                  className="shrink-0 rounded-md px-1.5 py-0.5 text-xs text-slate-400 hover:bg-red-500/10 hover:text-red-500"
                  title="Eliminar"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-4">
        {messages.length === 0 && !cargandoSesion && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3">
            <p className="mb-1 text-[11px] font-medium text-teal-600 dark:text-teal-400">SEACE Bot</p>
            <p className="text-sm">{BIENVENIDA}</p>
          </div>
        )}
        {cargandoSesion && (
          <p className="flex items-center gap-2 text-xs text-teal-600 dark:text-teal-400">
            <TypingDots /> Cargando conversación…
          </p>
        )}
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
                      : 'rounded-bl-sm border border-[var(--border)] bg-[var(--bg-card)]'
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
                    ? <MarkdownRenderer content={m.text} className="text-sm" />
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

      {!loading && (
        <div className="flex flex-wrap items-center gap-2 pb-3">
          {messages.length > 0 && (
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

      {prefillNro && (
        <p className="pb-2 text-[11px] text-[var(--text-secondary)]">
          <span className="rounded-full border border-[var(--border)] px-2 py-0.5">
            Continuando desde: {prefillNro}
          </span>
        </p>
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
          className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-teal-500 disabled:opacity-50"
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

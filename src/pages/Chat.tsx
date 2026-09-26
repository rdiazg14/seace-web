import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import type { SesionChat } from '../lib/chatSesiones'
import { ChatHistorial } from '../features/chat/components/ChatHistorial'
import { ChatMensaje, TypingDots } from '../features/chat/components/ChatMensaje'
import { BIENVENIDA, composeRagPrefill, SUGERENCIAS, usoContexto } from '../features/chat/model'
import { useChat } from '../features/chat/useChat'

export default function Chat() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const prefillApplied = useRef(false)
  const [prefillNro, setPrefillNro] = useState<string | null>(null)
  const [historialAbierto, setHistorialAbierto] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const chat = useChat(session?.user?.id ?? null)
  const { messages, loading, input, setInput } = chat

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
  }, [searchParams, setSearchParams, setInput])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  function abrirSesion(s: SesionChat) {
    setHistorialAbierto(false)
    void chat.abrirSesion(s)
  }

  function nuevaConversacion() {
    setHistorialAbierto(false)
    chat.nuevaConversacion()
  }

  const last = messages[messages.length - 1]
  const streaming = loading && last?.role === 'bot'
  const totalTokens = chat.totales.prompt + chat.totales.completion
  const { lastPrompt, pct: contextoPct } = usoContexto(messages)

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
          Historial ({chat.sesiones.length})
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
        <ChatHistorial
          sesiones={chat.sesiones}
          sesionId={chat.sesionId}
          onAbrir={abrirSesion}
          onEliminar={s => void chat.eliminarSesion(s)}
        />
      )}

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-4">
        {messages.length === 0 && !chat.cargandoSesion && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3">
            <p className="mb-1 text-[11px] font-medium text-teal-600 dark:text-teal-400">SEACE Bot</p>
            <p className="text-sm">{BIENVENIDA}</p>
          </div>
        )}
        {chat.cargandoSesion && (
          <p className="flex items-center gap-2 text-xs text-teal-600 dark:text-teal-400">
            <TypingDots /> Cargando conversación…
          </p>
        )}
        {messages.map((m, i) => (
          <ChatMensaje
            key={i}
            m={m}
            esperando={streaming && i === messages.length - 1}
            onSimilares={c => navigate(`/buscar?q=${encodeURIComponent((c.categoria_it || c.descripcion || '').slice(0, 80))}`)}
            onReintentar={q => void chat.enviar(q)}
            onBuscador={() => navigate('/buscar')}
          />
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
              onClick={() => void chat.enviar(s)}
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
        className="pb-4 pt-1"
        onSubmit={e => { e.preventDefault(); void chat.enviar() }}
      >
        <label className="mb-2 flex w-fit cursor-pointer items-center gap-2 text-xs text-[var(--text-secondary)]">
          <input
            type="checkbox"
            checked={chat.useWeb}
            onChange={e => chat.setUseWeb(e.target.checked)}
            disabled={loading}
            className="h-3.5 w-3.5 accent-teal-500"
          />
          Buscar en internet
        </label>
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void chat.enviar()
              }
            }}
            disabled={loading}
            rows={2}
            placeholder="Pregunta sobre TDR, specs, plazos… (Shift+Enter para salto de línea)"
            className="max-h-40 min-h-[2.5rem] flex-1 resize-y rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-teal-500 disabled:opacity-50"
          />
          {loading ? (
            <button
              type="button"
              onClick={chat.detener}
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
        </div>
      </form>
    </div>
  )
}

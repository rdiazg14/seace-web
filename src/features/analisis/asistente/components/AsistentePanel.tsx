/** Panel lateral del asistente del contrato: historial, respuestas, selector de modelo y formulario. */

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight, History, Loader2, MessageCircle, Trash2, X } from 'lucide-react'
import { MarkdownRenderer } from '../../../../components/MarkdownRenderer'
import { useAuth } from '../../../../lib/auth'
import { CHIPS_ESCENARIO, fmtCostoUsd, fmtUsd, labelModelo } from '../model'
import { useAsistente } from '../useAsistente'
import { AnalizandoBlock, EscenarioCard, Razonamiento, RespuestaStats } from './Respuesta'

export function AsistentePanel({
  contratoId,
  nro,
  contratoTitulo,
  categoriaIt,
  chipsIniciales,
  open,
  desktop,
  panelWidth,
  onResizeMouseDown,
  onOpen,
  onClose,
}: {
  contratoId: number
  nro: string
  contratoTitulo: string
  categoriaIt?: string | null
  chipsIniciales?: string[]
  open: boolean
  desktop: boolean
  panelWidth: number
  onResizeMouseDown: (e: ReactMouseEvent) => void
  onOpen: () => void
  onClose: () => void
}) {
  const navigate = useNavigate()
  const { session } = useAuth()
  const {
    messages,
    sesiones,
    sesionId,
    historialAbierto,
    alternarHistorial,
    cargandoSesion,
    input,
    setInput,
    loading,
    modelos,
    modelo,
    setModelo,
    useWeb,
    setUseWeb,
    usoGlobal,
    totalTokens,
    totalCosto,
    abrirSesion,
    nuevaConsulta,
    eliminarSesion,
    enviar,
  } = useAsistente(session?.user?.id ?? null, contratoId)
  const [hintFab, setHintFab] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const chips = (chipsIniciales && chipsIniciales.length > 0)
    ? chipsIniciales.map(c => c.trim()).filter(Boolean).map(c => c.slice(0, 40))
    : CHIPS_ESCENARIO
  const showChips = !loading && messages.length === 0 && !cargandoSesion

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading, open])

  useEffect(() => {
    try {
      setHintFab(!sessionStorage.getItem('seace-chat-fab-seen'))
    } catch {
      setHintFab(true)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    try { sessionStorage.setItem('seace-chat-fab-seen', '1') } catch { /* */ }
    setHintFab(false)
  }, [open])

  function markFabSeen() {
    try { sessionStorage.setItem('seace-chat-fab-seen', '1') } catch { /* */ }
    setHintFab(false)
  }

  function irChatRagConInternet(pregunta: string) {
    const params = new URLSearchParams()
    params.set('q', pregunta)
    params.set('nro', nro)
    params.set('titulo', contratoTitulo.slice(0, 160))
    if (categoriaIt) params.set('cat', categoriaIt)
    navigate(`/chat?${params.toString()}`)
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => { markFabSeen(); onOpen() }}
          aria-label="Abrir asistente del contrato"
          className={`fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-teal-500 text-white shadow-lg hover:bg-teal-400 ${
            hintFab ? 'animate-pulse' : ''
          }`}
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      <aside
        className={`fixed top-14 right-0 z-40 flex h-[calc(100dvh-3.5rem)] w-full flex-col border-l border-[var(--border)] bg-[var(--bg-card)] shadow-[-8px_0_24px_rgba(0,0,0,0.12)] transition-transform duration-[250ms] ease-out ${
          open ? 'translate-x-0' : 'pointer-events-none translate-x-full'
        }`}
        style={desktop ? { width: panelWidth } : undefined}
        aria-hidden={!open}
        aria-label="Asistente del contrato"
      >
        {desktop && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Redimensionar panel"
            className="absolute left-0 top-0 z-50 h-full w-1.5 cursor-col-resize touch-none hover:bg-teal-500/20"
            onMouseDown={onResizeMouseDown}
          />
        )}
        <header className="flex shrink-0 items-start justify-between gap-2 border-b border-[var(--border)] px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--text-primary)]">Asistente</p>
            <p className="truncate text-[11px] text-[var(--text-secondary)]">{nro}</p>
            {totalTokens > 0 && (
              <p className="text-[10px] text-teal-600 dark:text-teal-400">
                ⚡ {totalTokens.toLocaleString('es-PE')} tokens · {fmtCostoUsd(totalCosto)} en esta sesión
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={alternarHistorial}
              aria-label="Historial de conversaciones"
              className="flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
            >
              <History className="h-3.5 w-3.5" />
              <span>{sesiones.length}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Colapsar asistente"
              className="flex shrink-0 items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
            >
              <X className="h-4 w-4 lg:hidden" />
              <span className="hidden items-center gap-0.5 text-xs font-medium lg:inline-flex">
                Colapsar
                <ChevronRight className="h-4 w-4" />
              </span>
            </button>
          </div>
        </header>

        {historialAbierto && (
          <div className="max-h-56 shrink-0 overflow-y-auto border-b border-[var(--border)] px-3 py-2">
            {sesiones.length === 0 && (
              <p className="px-1 py-2 text-xs text-[var(--text-secondary)]">
                Todavía no hay conversaciones guardadas para este contrato.
              </p>
            )}
            <ul className="space-y-1">
              {sesiones.map(s => (
                <li
                  key={s.id}
                  className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 ${
                    s.id === sesionId ? 'bg-teal-500/10' : 'hover:bg-[var(--bg-secondary)]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => void abrirSesion(s)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-sm text-[var(--text-primary)]">{s.titulo}</p>
                    <p className="text-[11px] text-[var(--text-secondary)]">
                      {s.n_mensajes} msgs · {(s.tokens_prompt + s.tokens_completion).toLocaleString('es-PE')} tokens
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => void eliminarSesion(s)}
                    className="shrink-0 rounded-md px-1.5 py-0.5 text-xs text-slate-400 hover:bg-red-500/10 hover:text-red-500"
                    title="Eliminar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div ref={listRef} className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-3">
          {showChips && (
            <p className="mb-3 text-[12px] text-[var(--text-secondary)]">
              Preguntá sobre este contrato. El análisis de la página no cambia.
            </p>
          )}
          {cargandoSesion && (
            <p className="mb-3 flex items-center gap-2 text-xs text-teal-600 dark:text-teal-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando conversación…
            </p>
          )}
          <div className="space-y-3">
            {messages.map((m, idx) => {
              const preguntaUsuario = idx > 0 && messages[idx - 1]?.role === 'user'
                ? messages[idx - 1].text
                : ''
              const mostrarBuscarInternet = m.role === 'bot'
                && !m.streaming
                && m.clasificacion?.necesita_internet === true
                && Boolean(m.escenario || m.streamText)
                && Boolean(preguntaUsuario)
              return (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`min-w-0 max-w-[92%] ${m.role === 'user' ? '' : 'w-full'}`}>
                  {m.role === 'user' ? (
                    <p className="rounded-2xl rounded-br-sm bg-teal-500 px-3.5 py-2.5 text-sm text-white">{m.text}</p>
                  ) : m.aviso ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                      {m.text}
                    </div>
                  ) : m.limit ? (
                    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
                      {m.text}
                    </div>
                  ) : m.error ? (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm">
                      <p>{m.text}</p>
                      {m.query && (
                        <button
                          type="button"
                          onClick={() => void enviar(m.query)}
                          className="mt-2 text-xs font-medium text-teal-600 dark:text-teal-400"
                        >
                          Reintentar
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="min-w-0">
                      {m.progress && (
                        <AnalizandoBlock
                          phase={m.phase}
                          collapsed={Boolean(m.thought || m.streamBuffer || m.streamText || m.escenario)}
                        />
                      )}
                      {m.thought && (m.thoughtStreaming || !m.streaming) && (
                        <Razonamiento thought={m.thought} streaming={m.thoughtStreaming} />
                      )}
                      {m.escenario ? (
                        <EscenarioCard e={m.escenario} />
                      ) : m.streamText ? (
                        <MarkdownRenderer content={m.streamText} className="text-sm" />
                      ) : null}
                      {m.webSources && m.webSources.length > 0 && (
                        <div className="mt-2 space-y-1.5">
                          <p className="text-[11px] font-medium text-[var(--text-secondary)]">Fuentes web</p>
                          {m.webSources.map(src => (
                            <a
                              key={src.uri}
                              href={src.uri}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-xs text-teal-600 hover:border-teal-400 dark:text-teal-400"
                            >
                              <span className="truncate">{src.title}</span>
                              <span className="shrink-0 text-[var(--text-secondary)]">↗</span>
                            </a>
                          ))}
                        </div>
                      )}
                      {mostrarBuscarInternet && (
                        <button
                          type="button"
                          onClick={() => irChatRagConInternet(preguntaUsuario)}
                          className="mt-2 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-secondary)] hover:border-teal-400 hover:text-[var(--text-primary)]"
                        >
                          🔎 Buscar en TDRs relacionados
                        </button>
                      )}
                      {!m.streaming && <RespuestaStats m={m} />}
                    </div>
                  )}
                </div>
              </div>
            )})}
          </div>
        </div>

        <footer className="shrink-0 border-t border-[var(--border)] bg-[var(--bg-card)] px-3 py-2.5">
          {showChips && (
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {chips.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void enviar(s)}
                  className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)] hover:border-teal-400"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          {!loading && messages.length > 0 && (
            <div className="mb-2">
              <button
                type="button"
                onClick={nuevaConsulta}
                className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)] hover:border-red-300"
              >
                Nueva consulta
              </button>
            </div>
          )}
          <div className="mb-2 flex items-center gap-2">
            <label className="relative inline-flex items-center">
              <select
                value={modelo}
                onChange={e => setModelo(e.target.value)}
                disabled={loading}
                className="appearance-none rounded-full border border-[var(--border)] bg-[var(--bg-primary)] py-1 pl-3 pr-7 text-[11px] text-[var(--text-secondary)] outline-none focus:border-teal-500 disabled:opacity-50"
                title="Modelo"
              >
                {(modelos.length ? modelos : ['gemini-3.7-flash']).map(mm => (
                  <option key={mm} value={mm}>{labelModelo(mm)}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-[var(--text-secondary)]" />
            </label>
            {usoGlobal.saldo_usd != null ? (
              <span className="text-[11px] text-[var(--text-secondary)]">Saldo {fmtUsd(usoGlobal.saldo_usd)}</span>
            ) : usoGlobal.consumido_usd > 0 ? (
              <span className="text-[11px] text-[var(--text-secondary)]">Consumido {fmtUsd(usoGlobal.consumido_usd)}</span>
            ) : null}
          </div>
          <form
            onSubmit={e => { e.preventDefault(); void enviar() }}
          >
            <label className="mb-2 flex w-fit cursor-pointer items-center gap-2 text-[11px] text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={useWeb}
                onChange={e => setUseWeb(e.target.checked)}
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
                    void enviar()
                  }
                }}
                disabled={loading}
                rows={2}
                placeholder="¿Y si…? (Shift+Enter para salto de línea)"
                className="min-w-0 flex-1 resize-y rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-teal-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="shrink-0 rounded-xl bg-teal-500 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                Enviar
              </button>
            </div>
          </form>
        </footer>
      </aside>
    </>
  )
}

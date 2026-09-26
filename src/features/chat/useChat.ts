/**
 * Estado del chat general: sesiones persistidas, envío con streaming SSE,
 * cancelación y registro de tokens. Las reglas viven en model.ts.
 */

import { useEffect, useRef, useState } from 'react'
import {
  actualizarSesion,
  borrarSesion,
  cargarMensajes,
  crearSesion,
  guardarMensaje,
  listarSesiones,
  type SesionChat,
} from '../../lib/chatSesiones'
import { eventosSse } from '../../lib/sse'
import { cargarContratosCitados, consultarChat } from './api'
import {
  aplicarEventoChat,
  buildChatHistory,
  mensajeConexionFallida,
  mensajeDesdeJson,
  mensajeDesdeStream,
  mensajeHttpFallido,
  STREAM_INICIAL,
  type ChatMsg,
  type ErrorProxy,
  type EventoChat,
  type RespuestaJson,
  type Uso,
} from './model'

export function useChat(userId: string | null) {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [sesiones, setSesiones] = useState<SesionChat[]>([])
  const [sesionId, setSesionId] = useState<string | null>(null)
  const [totales, setTotales] = useState<Uso>({ prompt: 0, completion: 0 })
  const [cargandoSesion, setCargandoSesion] = useState(false)
  const [loading, setLoading] = useState(false)
  const [input, setInput] = useState('')
  const [useWeb, setUseWeb] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

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

  function patchLast(partial: Partial<ChatMsg>) {
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
    setInput('')
    try {
      const rows = await cargarMensajes(s.id)
      const msgs: ChatMsg[] = []
      for (const m of rows) {
        const refs = m.refs ?? undefined
        const contratos = refs?.length ? await cargarContratosCitados(refs) : undefined
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

  async function consumeJson(res: Response, query: string): Promise<ChatMsg> {
    const data = await res.json() as RespuestaJson
    const msg = mensajeDesdeJson(data, await cargarContratosCitados(data.contratos_referenciados ?? []), query)
    patchLast(msg)
    return msg
  }

  async function consumeSse(res: Response, query: string): Promise<ChatMsg> {
    let s = STREAM_INICIAL
    for await (const ev of eventosSse(res)) {
      const r = aplicarEventoChat(s, ev as EventoChat, query)
      if (r.error) throw new Error(r.error)
      s = r.s
      if (r.patch) patchLast(r.patch)
    }
    const msg = mensajeDesdeStream(s, await cargarContratosCitados(s.refs), query)
    patchLast(msg)
    return msg
  }

  async function enviar(texto = input): Promise<void> {
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

    let bot: ChatMsg | null = null
    try {
      const res = await consultarChat({ query: q, history, use_web: useWeb }, ac.signal)
      if (!res.ok) {
        let data: ErrorProxy = {}
        try {
          data = await res.json() as ErrorProxy
        } catch { /* cuerpo no JSON */ }
        bot = mensajeHttpFallido(res.status, data, q)
        patchLast(bot)
      } else {
        const ct = res.headers.get('content-type') || ''
        bot = ct.includes('text/event-stream') && res.body
          ? await consumeSse(res, q)
          : await consumeJson(res, q)
      }
    } catch (err) {
      bot = mensajeConexionFallida((err as Error).name === 'AbortError', q)
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
        await actualizarSesion(sid, { tokens_prompt: np, tokens_completion: nc, n_mensajes: n })
        void refrescarSesiones()
      } catch (e) {
        console.error('guardar bot', e)
      }
    }
  }

  return {
    messages,
    sesiones,
    sesionId,
    totales,
    cargandoSesion,
    loading,
    input,
    setInput,
    useWeb,
    setUseWeb,
    abrirSesion,
    nuevaConversacion,
    eliminarSesion,
    enviar,
    detener: () => abortRef.current?.abort(),
  }
}

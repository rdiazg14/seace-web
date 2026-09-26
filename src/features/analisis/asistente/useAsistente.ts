/**
 * Estado del asistente del contrato: sesiones por contrato, envío a /cotizar
 * (JSON o SSE), revelado diferido del primer texto, modelo y saldo estimado.
 * Las reglas viven en model.ts.
 */

import { useEffect, useRef, useState } from 'react'
import {
  actualizarSesion,
  borrarSesion,
  cargarMensajes,
  crearSesion,
  guardarMensaje,
  listarSesionesContrato,
  type SesionChat,
} from '../../../lib/chatSesiones'
import { consultarCotizar } from './api'
import {
  aplicarEventoCotizar,
  buildEscenaHistory,
  costoUsd,
  escenarioListo,
  falloBot,
  interpretarCotizarJson,
  msgDesdeFila,
  newMsgId,
  payloadBot,
  readSseEvents,
  revelarBuffer,
  STREAM_REVEAL_MS,
  tokensSesion,
  usoTokensTotal,
  type CotizarJson,
  type CotizarSseEvent,
  type EscenaMsg,
} from './model'

const MODELOS_INICIALES = ['gemini-3.1-flash-lite', 'gemini-3.7-flash', 'gemini-3.1-pro-preview']

export function useAsistente(userId: string | null, contratoId: number) {
  const [messages, setMessages] = useState<EscenaMsg[]>([])
  const [sesionId, setSesionId] = useState<string | null>(null)
  const [sesiones, setSesiones] = useState<SesionChat[]>([])
  const [historialAbierto, setHistorialAbierto] = useState(false)
  const [cargandoSesion, setCargandoSesion] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [modelos, setModelos] = useState<string[]>(MODELOS_INICIALES)
  const [modelo, setModelo] = useState<string>('gemini-3.1-flash-lite')
  const [useWeb, setUseWeb] = useState(false)
  const [usoGlobal, setUsoGlobal] = useState<{ consumido_usd: number; saldo_usd: number | null }>({
    consumido_usd: 0,
    saldo_usd: null,
  })
  const streamRevealTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelarRevelado = () => {
    if (streamRevealTimer.current) {
      clearTimeout(streamRevealTimer.current)
      streamRevealTimer.current = null
    }
  }

  const totalTokens = messages.reduce((acc, m) => acc + (m.role === 'bot' ? usoTokensTotal(m.usage) : 0), 0)
  const totalCosto = messages.reduce((acc, m) => acc + (m.role === 'bot' ? costoUsd(m.usage, m.model) : 0), 0)

  async function refrescarSesiones() {
    if (!userId) return
    try {
      setSesiones(await listarSesionesContrato(userId, contratoId))
    } catch (e) {
      console.error('listar sesiones contrato', e)
    }
  }

  async function abrirSesion(s: SesionChat) {
    setCargandoSesion(true)
    setSesionId(s.id)
    setHistorialAbierto(false)
    setInput('')
    try {
      const rows = await cargarMensajes(s.id)
      setMessages(rows.map(msgDesdeFila))
    } catch (e) {
      console.error('abrir sesion contrato', e)
      setMessages([])
    } finally {
      setCargandoSesion(false)
    }
  }

  function nuevaConsulta() {
    cancelarRevelado()
    setSesionId(null)
    setMessages([])
    setInput('')
    setHistorialAbierto(false)
  }

  async function eliminarSesion(s: SesionChat) {
    try {
      await borrarSesion(s.id)
      if (s.id === sesionId) nuevaConsulta()
      await refrescarSesiones()
    } catch (e) {
      console.error('borrar sesion contrato', e)
    }
  }

  useEffect(() => {
    if (!userId) return
    let cancel = false
    ;(async () => {
      try {
        const lista = await listarSesionesContrato(userId, contratoId)
        if (cancel) return
        setSesiones(lista)
        // Recupera automáticamente la conversación más reciente del contrato.
        if (lista.length > 0) await abrirSesion(lista[0])
      } catch (e) {
        console.error('cargar sesiones contrato', e)
      }
    })()
    return () => { cancel = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, contratoId])

  useEffect(() => {
    setInput('')
    setLoading(false)
    setSesionId(null)
    setMessages([])
    setHistorialAbierto(false)
    cancelarRevelado()
  }, [contratoId])

  useEffect(() => () => {
    if (streamRevealTimer.current) clearTimeout(streamRevealTimer.current)
  }, [])

  async function enviar(texto = input) {
    const q = texto.trim()
    if (!q || loading || !userId) return
    const history = buildEscenaHistory(messages)
    setInput('')
    // Mensaje bot rastreado de forma SÍNCRONA: React aplaza los updaters de
    // setState, por lo que leer el estado dentro de un updater para guardar en
    // BD era racy y perdía respuestas al refrescar.
    let botMsg: EscenaMsg = {
      id: newMsgId(),
      role: 'bot',
      text: '',
      streaming: true,
      progress: true,
      phase: 'clasificar',
      streamText: '',
    }
    setMessages(m => [...m, { id: newMsgId(), role: 'user', text: q }, botMsg])
    setLoading(true)

    // Asegura sesión en BD (se crea en el primer envío, con el título = pregunta).
    let sid = sesionId
    if (!sid) {
      try {
        const s = await crearSesion(userId, q.slice(0, 40), contratoId)
        sid = s.id
        setSesionId(s.id)
      } catch (e) {
        console.error('crear sesion contrato', e)
      }
    }
    if (sid) {
      guardarMensaje({ sesion_id: sid, user_id: userId, rol: 'user', texto: q })
        .catch(e => console.error('guardar user contrato', e))
    }

    let botFinal: EscenaMsg | null = null
    const patchBot = (upd: (prev: EscenaMsg) => EscenaMsg) => {
      // Rastrea síncronamente el estado real del mensaje bot, fuera del updater
      // de React, para poder guardarlo en BD al final sin depender del render.
      const resolved = upd(botMsg)
      botMsg = resolved
      botFinal = resolved
      setMessages(m => {
        const next = [...m]
        const last = next[next.length - 1]
        if (!last || last.role !== 'bot') return m
        next[next.length - 1] = resolved
        return next
      })
    }

    const programarRevelado = () => {
      if (streamRevealTimer.current) return
      streamRevealTimer.current = setTimeout(() => {
        streamRevealTimer.current = null
        patchBot(revelarBuffer)
      }, STREAM_REVEAL_MS)
    }

    const applyMeta = (p: CotizarJson | CotizarSseEvent) => {
      if (p.models && p.models.length) setModelos(p.models)
      if (p.model) setModelo(p.model)
      setUsoGlobal({ consumido_usd: p.consumido_usd ?? 0, saldo_usd: p.saldo_usd ?? null })
    }

    cancelarRevelado()

    try {
      const res = await consultarCotizar({ contrato_id: contratoId, query: q, history, model: modelo, use_web: useWeb })
      const isSse = (res.headers.get('content-type') || '').includes('text/event-stream')

      if (!isSse || !res.ok) {
        let payload: CotizarJson = {}
        try {
          payload = await res.json() as CotizarJson
        } catch {
          payload = {}
        }
        const r = interpretarCotizarJson(res.status, res.ok, payload, q)
        if (r.kind === 'excepcion') throw new Error(r.message)
        if (r.kind === 'fallo') {
          cancelarRevelado()
          patchBot(prev => falloBot(prev, r.text, r.extra))
          return
        }
        patchBot(prev => escenarioListo(prev, payload, r.escenario))
        applyMeta(payload)
        return
      }

      let gotData = false
      let streamErr: string | null = null
      await readSseEvents(res, (ev) => {
        const efecto = aplicarEventoCotizar(botMsg, ev)
        if (efecto.error) {
          streamErr = efecto.error
          return
        }
        if (efecto.datos) {
          gotData = true
          cancelarRevelado()
        }
        if (efecto.msg !== botMsg) patchBot(() => efecto.msg)
        if (efecto.programarRevelado) programarRevelado()
        if (efecto.datos) applyMeta(efecto.datos)
      })
      if (streamErr) throw new Error(streamErr)
      if (!gotData) throw new Error('respuesta incompleta')
    } catch (err) {
      const errMsg: EscenaMsg = {
        id: botMsg.id,
        role: 'bot',
        type: 'error',
        query: q,
        text: err instanceof Error ? err.message : 'No pude recalcular el escenario',
        error: true,
      }
      botMsg = errMsg
      botFinal = errMsg
      setMessages(m => {
        const next = [...m]
        const prev = next[next.length - 1]
        next[next.length - 1] = { ...errMsg, id: prev?.id ?? errMsg.id }
        return next
      })
    } finally {
      setLoading(false)
    }

    if (sid && botFinal) {
      const b: EscenaMsg = botFinal
      try {
        await guardarMensaje({
          sesion_id: sid,
          user_id: userId,
          rol: 'bot',
          texto: b.text || (b.escenario?.escenario ?? ''),
          tokens_prompt: b.usage?.prompt ?? 0,
          tokens_completion: b.usage?.completion ?? 0,
          error: b.error ?? false,
          limit_flag: b.limit ?? false,
          payload: payloadBot(b),
        })
        const acu = tokensSesion(messages, b)
        await actualizarSesion(sid, {
          tokens_prompt: acu.prompt,
          tokens_completion: acu.completion,
          n_mensajes: messages.length + 2,
        })
        void refrescarSesiones()
      } catch (e) {
        console.error('guardar bot contrato', e, usoTokensTotal(b.usage))
      }
    }
  }

  return {
    messages,
    sesiones,
    sesionId,
    historialAbierto,
    alternarHistorial: () => setHistorialAbierto(v => !v),
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
  }
}

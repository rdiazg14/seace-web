import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Contrato } from '../types'

const AI_PROXY = 'https://seace-ai-proxy.rdiazg14.workers.dev'

async function preguntarIA(query: string, contratos: Contrato[]): Promise<string> {
  const res = await fetch(AI_PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, contratos }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json() as { response: string }
  return data.response
}

interface Message {
  role: 'user' | 'bot'
  text: string
  contratos?: Contrato[]
}

function fmtFecha(s: string | null) {
  if (!s) return ''
  return new Date(s).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
}

function parsearConsulta(input: string) {
  const lower = input.toLowerCase()

  let filtro_estado: string | null = null
  if (/vigent/.test(lower)) filtro_estado = 'Vigente'
  else if (/culminad|cerrad/.test(lower)) filtro_estado = 'Culminado'
  else if (/evaluaci/.test(lower)) filtro_estado = 'En Evaluación'

  let filtro_objeto: string | null = null
  if (/\bservicio/.test(lower)) filtro_objeto = 'Servicio'
  else if (/\bbien\b/.test(lower)) filtro_objeto = 'Bien'
  else if (/consultor/.test(lower)) filtro_objeto = 'Consultoría de Obra'
  else if (/\bobra\b/.test(lower)) filtro_objeto = 'Obra'

  const termino = input
    .replace(/vigentes?|culminad[oa]s?|servicios?|bienes?/gi, '')
    .replace(/busca(r)?|muéstrame|muéstrame|muestra(me)?|lista(r)?|encuentra|dame|dime|hay|cuáles?/gi, '')
    .replace(/contratos?|contrataciones?/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

  return { termino, filtro_objeto, filtro_estado }
}

const SUGERENCIAS = [
  'contratos de token vigentes',
  'ciberseguridad servicio',
  'inteligencia artificial vigente',
  'oracle base de datos',
  'microsoft 365',
  'desarrollo de software vigente',
]

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'bot',
      text: '¡Hola! Soy el asistente SEACE con IA (Llama 3.1). Pregúntame sobre contratos públicos del Estado peruano — busco en 76,250 registros y analizo los resultados.\n\nEjemplos: "contratos de token vigentes", "ciberseguridad servicio", "inteligencia artificial"',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function enviar(texto = input) {
    if (!texto.trim() || loading) return
    const userMsg = texto.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: userMsg }])
    setLoading(true)

    const { termino, filtro_objeto, filtro_estado } = parsearConsulta(userMsg)

    const { data, error } = await supabase.rpc('buscar_contratos', {
      termino: termino || '',
      filtro_objeto,
      filtro_estado,
      filtro_entidad: null,
      limite: 6,
      offset_val: 0,
    })

    const contratos = (data as Contrato[]) ?? []

    if (error) {
      setMessages(prev => [...prev, { role: 'bot', text: 'Hubo un error al consultar la base de datos. Intenta de nuevo.' }])
      setLoading(false)
      return
    }

    // Intentar respuesta con IA; fallback a texto simple si falla
    let respuesta = ''
    try {
      respuesta = await preguntarIA(userMsg, contratos)
    } catch {
      if (contratos.length === 0) {
        respuesta = `No encontré contratos para "${userMsg}". Prueba con: "oracle", "microsoft", "ciberseguridad" o "token".`
      } else {
        const n = contratos.length
        respuesta = `Encontré ${n} contrato${n !== 1 ? 's' : ''} para "${termino || userMsg}".`
      }
    }

    setMessages(prev => [
      ...prev,
      { role: 'bot', text: respuesta, contratos: contratos.length > 0 ? contratos : undefined },
    ])
    setLoading(false)
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 flex flex-col" style={{ height: 'calc(100vh - 3.5rem)' }}>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-slate-100">Chat SEACE</h1>
        <p className="text-slate-400 text-sm">Consulta en lenguaje natural · búsqueda rule-based</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] ${m.role === 'user' ? 'order-2' : ''}`}>
              {m.role === 'bot' && (
                <span className="text-xs text-emerald-400 font-medium mb-1 block">SEACE Bot</span>
              )}
              <div className={`rounded-xl px-4 py-2.5 text-sm ${
                m.role === 'user'
                  ? 'bg-emerald-600 text-white rounded-br-sm'
                  : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-bl-sm'
              }`}>
                {m.text.split('\n').map((line, j) => (
                  <span key={j}>
                    {line.replace(/\*\*(.*?)\*\*/g, '$1')}
                    {j < m.text.split('\n').length - 1 && <br />}
                  </span>
                ))}
              </div>

              {m.contratos && m.contratos.length > 0 && (
                <div className="mt-2 space-y-2">
                  {m.contratos.map(c => (
                    <div key={c.id} className="bg-slate-800/80 border border-slate-700 rounded-lg p-3 text-xs">
                      <div className="flex flex-wrap gap-1 mb-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          c.estado === 'Vigente' ? 'bg-emerald-500/20 text-emerald-400' :
                          c.estado === 'En Evaluación' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-slate-600 text-slate-300'
                        }`}>{c.estado}</span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">{c.objeto}</span>
                        {c.relevancia_ia && (
                          <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">IA {c.relevancia_ia}</span>
                        )}
                      </div>
                      <p className="text-slate-200 font-medium line-clamp-2 mb-1">{c.descripcion}</p>
                      <p className="text-slate-400">{c.entidad}</p>
                      {c.fecha_fin_cotizacion && (
                        <p className="text-slate-500 mt-1">Cierre: {fmtFecha(c.fecha_fin_cotizacion)}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3">
              <div className="flex gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Sugerencias */}
      {messages.length === 1 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {SUGERENCIAS.map(s => (
            <button
              key={s}
              onClick={() => enviar(s)}
              className="text-xs px-3 py-1.5 bg-slate-800 border border-slate-700 hover:border-emerald-500 text-slate-300 hover:text-emerald-400 rounded-full transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={e => { e.preventDefault(); enviar() }} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Escribe tu consulta sobre contratos SEACE…"
          disabled={loading}
          className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm rounded-xl transition-colors"
        >
          Enviar
        </button>
      </form>
    </div>
  )
}

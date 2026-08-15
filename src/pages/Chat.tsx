import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AI_PROXY, supabase } from '../lib/supabase'
import type { Contrato, ContratoRef } from '../types'
import ContratoCard from '../components/ContratoCard'
import { Skeleton } from '../components/ui'

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
}

type Stage = 'idle' | 'search' | 'ai' | 'slow'

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

export default function Chat() {
  const navigate = useNavigate()
  const [messages, setMessages] = useState<Msg[]>([{
    role: 'bot',
    text: 'Soy el asistente SEACE con IA. Busco en los Términos de Referencia reales de 2,330 contratos vigentes. Pregúntame sobre requisitos técnicos, especificaciones, plazos o cualquier detalle.',
  }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [stage, setStage] = useState<Stage>('idle')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (!loading) {
      setStage('idle')
      return
    }
    setStage('search')
    const a = window.setTimeout(() => setStage('ai'), 3000)
    const b = window.setTimeout(() => setStage('slow'), 20000)
    return () => {
      window.clearTimeout(a)
      window.clearTimeout(b)
    }
  }, [loading])

  async function enviar(texto = input) {
    const q = texto.trim()
    if (!q || loading) return
    setInput('')
    setMessages(m => [...m, { role: 'user', text: q }])
    setLoading(true)
    try {
      const res = await fetch(AI_PROXY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as {
        respuesta?: string
        response?: string
        contratos_referenciados?: ContratoRef[]
        error?: string
      }
      const refs = data.contratos_referenciados ?? []
      let contratos: Contrato[] = []
      if (refs.length) {
        const ids = refs.map(r => r.id)
        const { data: rows } = await supabase.from('contratos').select('*').in('id', ids)
        const byId = new Map((rows as Contrato[] ?? []).map(c => [c.id, c]))
        contratos = ids.map(id => byId.get(id)).filter((c): c is Contrato => Boolean(c))
      }
      const text = data.respuesta || data.response || 'No pude generar una respuesta.'
      setMessages(m => [...m, { role: 'bot', text, contratos, error: Boolean(data.error) }])
    } catch {
      setMessages(m => [...m, {
        role: 'bot',
        error: true,
        text: 'No pude consultar la IA ahora. Prueba de nuevo o usa el buscador para filtrar por texto.',
      }])
    } finally {
      setLoading(false)
    }
  }

  const stageLabel =
    stage === 'search' ? 'Buscando en 9,074 fragmentos…'
      : stage === 'ai' ? 'Analizando con IA…'
        : stage === 'slow' ? 'Tomando más tiempo del usual…'
          : ''

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
                {m.role === 'bot' ? <RichText text={m.text} /> : <p className="text-sm">{m.text}</p>}
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
                <button
                  type="button"
                  onClick={() => navigate('/buscar')}
                  className="mt-2 text-xs font-medium text-teal-600 dark:text-teal-400"
                >
                  Ir al buscador
                </button>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="space-y-2">
            <p className="text-xs text-teal-600 dark:text-teal-400">{stageLabel}</p>
            <Skeleton className="h-20 w-4/5" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}
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
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
        >
          Enviar
        </button>
      </form>
    </div>
  )
}

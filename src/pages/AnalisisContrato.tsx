import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase, AI_PROXY } from '../lib/supabase'
import type { Contrato } from '../types'
import { cierraEn, fmtFecha, nroContrato, seaceUrl, tituloContrato } from '../lib/format'
import {
  labelCalifica,
  labelModalidad,
  labelRubro,
  labelVeredicto,
  soles,
  escenarioMuestraCifras,
  type AnalisisResponse,
  type EscenarioPayload,
  type TonoCond,
} from '../lib/analisis'
import { CierraPill, EstadoPill, ItPill } from '../components/Pills'
import { ErrorBox, Skeleton } from '../components/ui'

function tonoCls(t: TonoCond): string {
  if (t === 'ok') return 'border-emerald-500/40 bg-emerald-500/10'
  if (t === 'bad') return 'border-red-500/40 bg-red-500/10'
  return 'border-amber-500/40 bg-amber-500/10'
}

function CondCard({
  title,
  value,
  detail,
  tono,
}: {
  title: string
  value: string
  detail?: string
  tono: TonoCond
}) {
  return (
    <div className={`rounded-xl border p-3 ${tonoCls(tono)}`}>
      <p className="text-[11px] text-slate-500">{title}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
      {detail && <p className="mt-1 text-[11px] text-slate-500">{detail}</p>}
    </div>
  )
}

export default function AnalisisContrato() {
  const { id } = useParams()
  const contratoId = Number(id)
  const [ficha, setFicha] = useState<Contrato | null>(null)
  const [data, setData] = useState<AnalisisResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sinTdr, setSinTdr] = useState<string | null>(null)

  useEffect(() => {
    const ac = new AbortController()
    async function load() {
      if (!Number.isFinite(contratoId) || contratoId <= 0) {
        setError('Contrato inválido')
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      setSinTdr(null)
      setData(null)
      try {
        const { data: row, error: err } = await supabase
          .from('contratos')
          .select('id,nro_contratacion,descripcion_contrato,descripcion,entidad,estado,objeto,nom_area_usuaria,fecha_publica,fecha_fin_cotizacion,tipo_cotizacion,categoria_it,relevancia_ia')
          .eq('id', contratoId)
          .maybeSingle()
        if (err) throw err
        if (!row) throw new Error('Contrato no encontrado')
        if (ac.signal.aborted) return
        setFicha(row as Contrato)

        const res = await fetch(`${AI_PROXY}/analizar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contrato_id: contratoId }),
          signal: ac.signal,
        })
        const payload = await res.json() as AnalisisResponse & {
          error?: string
          respuesta?: string
          status?: string
          mensaje?: string
        }
        if (ac.signal.aborted) return
        if (res.status === 422 && payload.status === 'sin_tdr') {
          setSinTdr(payload.mensaje || 'este contrato no tiene TDR suficiente para analizar')
          return
        }
        if (!res.ok) {
          throw new Error(payload.respuesta || payload.error || `HTTP ${res.status}`)
        }
        if (payload.error && !payload.analisis) {
          throw new Error(payload.error)
        }
        setData(payload)
      } catch (e) {
        if ((e as Error).name === 'AbortError' || ac.signal.aborted) return
        setError(e instanceof Error ? e.message : 'No se pudo analizar')
      } finally {
        if (!ac.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => { ac.abort() }
  }, [contratoId])

  const a = data?.analisis
  const cierre = cierraEn(ficha?.fecha_fin_cotizacion ?? null)

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-3 py-5 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to="/ruta-dia" className="text-xs font-medium text-teal-600 dark:text-teal-400">
          ← Ruta del día
        </Link>
        {ficha && (
          <a
            href={seaceUrl(ficha.id)}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-teal-500 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-teal-400"
          >
            Ver en SEACE
          </a>
        )}
      </div>

      <header>
        <p className="text-[11px] uppercase tracking-wide text-slate-400">Análisis de contrato</p>
        <h1 className="mt-0.5 text-xl text-slate-900 sm:text-2xl dark:text-slate-50">
          {ficha ? nroContrato(ficha) : `Contrato ${id}`}
        </h1>
        {ficha && (
          <>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{tituloContrato(ficha)}</p>
            <p className="text-xs text-slate-500">{ficha.entidad}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              <EstadoPill estado={ficha.estado} />
              {ficha.categoria_it && <ItPill cat={ficha.categoria_it} />}
              {ficha.fecha_fin_cotizacion && ficha.estado === 'Vigente' && (
                <CierraPill label={cierre.label} tone={cierre.tone} />
              )}
              {data?.urgente && (
                <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:text-red-400">
                  Urgente
                </span>
              )}
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              Pub. {fmtFecha(ficha.fecha_publica)}
              {ficha.fecha_fin_cotizacion && <> · Cierre {fmtFecha(ficha.fecha_fin_cotizacion)}</>}
              {ficha.tipo_cotizacion && <> · Tipo cotiz. {ficha.tipo_cotizacion}</>}
            </p>
          </>
        )}
      </header>

      {sinTdr && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
          {sinTdr}
        </div>
      )}

      {error && (
        <ErrorBox retry={() => window.location.reload()}>{error}</ErrorBox>
      )}

      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-40" />
        </div>
      )}

      {a && data && (
        <>
          <p className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-500 dark:border-slate-800 dark:bg-slate-900">
            Guía para decidir, no una cotización. Techo 8 UIT = {soles(data.techo_soles)}.
            TDR: {data.tdr_fuente === 'ficha' ? 'sin texto extraído (solo ficha)' : `${data.tdr_fuente} · ${data.tdr_chars.toLocaleString('es-PE')} chars`}.
            El número final lo pone ENERTRONIC.
          </p>

          <VeredictoBanner
            codigo={a.veredicto.codigo}
            urgente={data.urgente}
            razon={a.veredicto.razonamiento}
            aviso={a.veredicto.aviso_humano}
          />

          <section>
            <h2 className="mb-1 text-sm font-medium">Qué se contrata</h2>
            <p className="text-sm text-slate-700 dark:text-slate-300">{a.resumen}</p>
          </section>

          <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[11px] text-slate-500">Encaje</p>
              <p className="mt-1 text-sm font-medium">
                {labelRubro(a.encaje.rubro)} · {labelCalifica(a.encaje.califica)}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">Perfil pedido: {a.encaje.perfil_pedido || 'no consta'}</p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{a.encaje.razon}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[11px] text-slate-500">Economía (estimaciones)</p>
              <p className="mt-1 text-sm">Valor est. {soles(a.economia.valor_estimado_soles)}</p>
              <p className="text-sm">Costo est. {soles(a.economia.costo_estimado_soles)}</p>
              <p className="text-sm font-medium">Margen est. {soles(a.economia.margen_soles)}</p>
              <p className="mt-2 text-[11px] text-slate-500">{a.economia.pistas_valor}</p>
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-medium">Condiciones (del TDR)</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <CondCard
                title="Modalidad"
                value={labelModalidad(a.condiciones.modalidad)}
                detail={a.condiciones.modalidad_detalle}
                tono={a.condiciones.tono_modalidad}
              />
              <CondCard
                title="Pago"
                value={a.condiciones.armadas != null ? `${a.condiciones.armadas} armada(s)` : 'Ver detalle'}
                detail={a.condiciones.pago}
                tono={a.condiciones.tono_pago}
              />
              <CondCard
                title="Plazo"
                value={a.condiciones.plazo || 'No consta'}
                tono={a.condiciones.tono_plazo}
              />
              <CondCard
                title="Penalidades"
                value={a.condiciones.penalidades ? 'Ver detalle' : 'No consta'}
                detail={a.condiciones.penalidades}
                tono={a.condiciones.tono_penalidad}
              />
            </div>
          </section>

          <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-sm font-medium">Supuestos (explícitos)</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-[12px] text-slate-600 dark:text-slate-300">
                {(a.economia.supuestos || []).map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
              <p className="text-sm font-medium">Lo que la IA no sabe</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-[12px] text-slate-600 dark:text-slate-300">
                {(a.economia.lo_que_no_sabe || []).map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          </section>

          {(a.optimizacion || []).length > 0 && (
            <section className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-sm font-medium">Cómo mejorar el margen</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-600 dark:text-slate-300">
                {a.optimizacion.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </section>
          )}

          <section className="rounded-xl border border-dashed border-slate-300 p-3 dark:border-slate-700">
            <p className="text-sm font-medium">Chat de escenarios</p>
            <p className="mt-1 text-[12px] text-slate-500">
              El análisis de arriba no cambia. Acá se recalcula un escenario con supuestos explícitos.
              El número final lo pone ENERTRONIC.
            </p>
            <ChatEscenarios contratoId={contratoId} />
          </section>
        </>
      )}
    </div>
  )
}

const CHIPS_ESCENARIO = [
  'instancias más chicas',
  '¿y si subo al techo S/40k?',
  'subcontratar la nube',
]

const HISTORY_MAX_ITEMS = 8
const HISTORY_MAX_CHARS = 500

interface EscenaMsg {
  role: 'user' | 'bot'
  text: string
  escenario?: EscenarioPayload | null
  error?: boolean
  limit?: boolean
  aviso?: boolean
}

function buildEscenaHistory(messages: EscenaMsg[]): { role: 'user' | 'bot'; text: string }[] {
  const out: { role: 'user' | 'bot'; text: string }[] = []
  for (const m of messages) {
    if (m.error || m.limit || m.aviso) continue
    if (m.role === 'bot' && !m.text.trim()) continue
    out.push({ role: m.role, text: m.text.slice(0, HISTORY_MAX_CHARS) })
  }
  return out.slice(-HISTORY_MAX_ITEMS)
}

function botHistoryText(e: EscenarioPayload): string {
  if (!escenarioMuestraCifras(e)) {
    return `${e.escenario}: escenario sin supuestos declarados, no se estima monto`
  }
  return `${e.escenario}. Asumiendo: ${e.supuestos_aplicados.join('; ')}`
}

function EscenarioCard({ e }: { e: EscenarioPayload }) {
  const show = escenarioMuestraCifras(e)
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <span className="rounded-full bg-teal-500/15 px-2 py-0.5 text-[11px] font-medium text-teal-700 dark:text-teal-300">
        Escenario estimado
      </span>
      <p className="mt-2 text-sm font-medium">{e.escenario}</p>
      {show ? (
        <>
          <p className="mt-1 text-sm text-slate-800 dark:text-slate-100">
            Valor {soles(e.valor_estimado_soles)} · Costo {soles(e.costo_estimado_soles)} · Margen {soles(e.margen_estimado_soles)}
          </p>
          <p className="mt-1 text-sm text-slate-800 dark:text-slate-100">
            Asumiendo: {e.supuestos_aplicados.join('; ')}. — {e.nota}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Cambió vs análisis: {e.cambio_vs_analisis || '—'}
            {e.sigue_sin_saberse.length > 0 && (
              <> · Sigue sin saberse: {e.sigue_sin_saberse.join('; ')}</>
            )}
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
          escenario sin supuestos declarados, no se estima monto
        </p>
      )}
    </div>
  )
}

function ChatEscenarios({ contratoId }: { contratoId: number }) {
  const [messages, setMessages] = useState<EscenaMsg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  async function enviar(texto = input) {
    const q = texto.trim()
    if (!q || loading) return
    const history = buildEscenaHistory(messages)
    setInput('')
    setMessages(m => [...m, { role: 'user', text: q }, { role: 'bot', text: '' }])
    setLoading(true)
    try {
      const res = await fetch(`${AI_PROXY}/cotizar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contrato_id: contratoId, query: q, history }),
      })
      const payload = await res.json() as {
        escenario?: EscenarioPayload
        status?: string
        mensaje?: string
        error?: string
        respuesta?: string
      }
      if (res.status === 409 && payload.status === 'sin_analisis') {
        setMessages(m => {
          const next = [...m]
          next[next.length - 1] = {
            role: 'bot',
            text: payload.mensaje || 'Primero analizá el contrato',
            aviso: true,
          }
          return next
        })
        return
      }
      if (res.status === 429 || res.status === 503
        || payload.error === 'rate_limited'
        || payload.error === 'daily_limited'
        || payload.error === 'over_capacity') {
        setMessages(m => {
          const next = [...m]
          next[next.length - 1] = {
            role: 'bot',
            text: payload.respuesta || payload.mensaje
              || (res.status === 503
                ? 'Hay alta demanda en el asistente. Intenta más tarde.'
                : 'Has hecho demasiadas consultas. Espera un minuto e intenta de nuevo.'),
            limit: true,
          }
          return next
        })
        return
      }
      if (!res.ok || !payload.escenario) {
        throw new Error(payload.respuesta || payload.error || `HTTP ${res.status}`)
      }
      const e = payload.escenario
      setMessages(m => {
        const next = [...m]
        next[next.length - 1] = {
          role: 'bot',
          text: botHistoryText(e),
          escenario: e,
        }
        return next
      })
    } catch (err) {
      setMessages(m => {
        const next = [...m]
        next[next.length - 1] = {
          role: 'bot',
          text: err instanceof Error ? err.message : 'No pude recalcular el escenario',
          error: true,
        }
        return next
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-3 space-y-3">
      {messages.map((m, i) => (
        <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[92%] ${m.role === 'user' ? '' : 'w-full'}`}>
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
                {m.text}
              </div>
            ) : m.escenario ? (
              <EscenarioCard e={m.escenario} />
            ) : (
              <p className="text-xs text-slate-500">{loading && i === messages.length - 1 ? 'Recalculando escenario…' : m.text}</p>
            )}
          </div>
        </div>
      ))}

      {!loading && (
        <div className="flex flex-wrap gap-2">
          {CHIPS_ESCENARIO.map(s => (
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
        className="flex gap-2"
        onSubmit={e => { e.preventDefault(); void enviar() }}
      >
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={loading}
          placeholder="¿Y si…? (el análisis de arriba no cambia)"
          className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="rounded-xl bg-teal-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          Enviar
        </button>
      </form>
    </div>
  )
}

function VeredictoBanner({
  codigo,
  urgente,
  razon,
  aviso,
}: {
  codigo: 'recomendado' | 'evaluar' | 'no_recomendado'
  urgente: boolean
  razon: string
  aviso: string
}) {
  const wrap =
    codigo === 'recomendado'
      ? 'border-emerald-500/40 bg-emerald-500/10'
      : codigo === 'no_recomendado'
        ? 'border-red-500/40 bg-red-500/10'
        : 'border-amber-500/40 bg-amber-500/10'
  return (
    <div className={`rounded-xl border p-4 ${wrap}`}>
      <div className="flex flex-wrap items-center gap-2">
        {urgente && (
          <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:text-red-400">
            Urgente
          </span>
        )}
        <p className="text-base font-medium">{labelVeredicto(codigo)}</p>
      </div>
      <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{razon}</p>
      <p className="mt-2 text-[11px] text-slate-500">{aviso}</p>
    </div>
  )
}

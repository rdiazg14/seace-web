import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
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
  type ClausulaCritica,
  type EntregableContractual,
  type EscenarioPayload,
  type ChatGrafica,
  type ChatTabla,
  type RequisitosProveedor,
  type RiesgosContractuales,
  type TonoCond,
} from '../lib/analisis'
import { CierraPill, EstadoPill, ItPill } from '../components/Pills'
import { ErrorBox, Skeleton } from '../components/ui'
import { MarkdownRenderer } from '../components/MarkdownRenderer'
import { TimelineCard } from '../components/TimelineFishbone'
import { ChatTable } from '../components/ChatTable'
import { ChatChart } from '../components/ChatChart'
import {
  AlternativasBlock,
  ComponentesTabs,
  ContradiccionesBlock,
  EconomiaPorComponente,
  InfografiaRatio,
  descalificadorDe,
} from '../components/AnalisisV2'

function tonoCls(t: TonoCond): string {
  if (t === 'ok') return 'border-emerald-500/40 bg-emerald-500/10'
  if (t === 'bad') return 'border-red-500/40 bg-red-500/10'
  return 'border-amber-500/40 bg-amber-500/10'
}

function riesgoCls(r: 'alto' | 'medio' | 'bajo'): string {
  if (r === 'alto') return 'bg-red-500/15 text-red-700 dark:text-red-300'
  if (r === 'medio') return 'bg-amber-500/15 text-amber-800 dark:text-amber-200'
  return 'bg-slate-500/15 text-slate-600 dark:text-slate-300'
}

function impactoBorder(r: 'alto' | 'medio' | 'bajo'): string {
  if (r === 'alto') return 'border-red-500/40 bg-red-500/10'
  if (r === 'medio') return 'border-amber-500/40 bg-amber-500/10'
  return 'border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900'
}

function labelPlazoRef(r?: EntregableContractual['plazo_referencia']): string {
  if (r === 'desde_notificacion') return 'Desde notificación'
  if (r === 'desde_conclusion') return 'Desde conclusión'
  if (r === 'otro') return 'Otro'
  return '—'
}

function RequisitosBlock({ r }: { r: RequisitosProveedor }) {
  const consorcio = r.admite_consorcio
  const certs = r.certificaciones_especificas
  return (
    <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-800">
      <p className="text-[11px] text-slate-500">Requisitos del proveedor</p>
      {(r.habilitaciones?.length ?? 0) > 0 && (
        <ul className="mt-1 space-y-0.5 text-[12px] text-slate-600 dark:text-slate-300">
          {r.habilitaciones!.map((h, i) => <li key={i}>✅ {h}</li>)}
        </ul>
      )}
      {r.experiencia_minima && (
        <p className="mt-1 text-[12px] text-slate-600 dark:text-slate-300">✅ {r.experiencia_minima}</p>
      )}
      {Array.isArray(certs) && certs.length === 0 && (
        <span className="mt-2 inline-block rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
          Sin certificaciones específicas requeridas
        </span>
      )}
      {(certs?.length ?? 0) > 0 && (
        <ul className="mt-1 list-disc pl-4 text-[12px] text-slate-600 dark:text-slate-300">
          {certs!.map((c, i) => <li key={i}>{c}</li>)}
        </ul>
      )}
      <p className="mt-2 text-[11px]">
        {consorcio === true && (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-medium text-emerald-700 dark:text-emerald-300">✓ Consorcio: Sí</span>
        )}
        {consorcio === false && (
          <span className="rounded-full bg-red-500/15 px-2 py-0.5 font-medium text-red-700 dark:text-red-300">✕ Consorcio: No</span>
        )}
        {consorcio == null && (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-medium text-amber-800 dark:text-amber-200">⚠ Consorcio: no consta en TDR — verificar en bases</span>
        )}
      </p>
    </div>
  )
}

function EntregablesTable({ items }: { items: EntregableContractual[] }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-medium">Entregables</h2>
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full min-w-[520px] text-left text-[12px]">
          <thead className="bg-slate-50 text-[11px] text-slate-500 dark:bg-slate-900">
            <tr>
              <th className="px-3 py-2 font-medium">Entregable</th>
              <th className="px-3 py-2 font-medium">Plazo</th>
              <th className="px-3 py-2 font-medium">Referencia</th>
              <th className="px-3 py-2 font-medium">Riesgo</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e, i) => (
              <tr key={`${e.nombre}-${i}`} className="border-t border-slate-200 dark:border-slate-800">
                <td className="px-3 py-2">
                  <p className="font-medium text-slate-800 dark:text-slate-100">{e.nombre}</p>
                  {e.descripcion && <p className="mt-0.5 text-slate-500">{e.descripcion}</p>}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {e.plazo_dias != null ? `${e.plazo_dias} días` : '—'}
                </td>
                <td className="px-3 py-2">{labelPlazoRef(e.plazo_referencia)}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${riesgoCls(e.riesgo_penalidad)}`}>
                    {e.riesgo_penalidad}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function RiesgosBlock({ r }: { r: RiesgosContractuales }) {
  const criticas: ClausulaCritica[] = r.clausulas_criticas || []
  return (
    <section>
      <h2 className="mb-2 text-sm font-medium">Riesgos contractuales</h2>
      <div className="mb-3 flex flex-wrap gap-2 text-[11px]">
        {r.propiedad_materiales && (
          <span className="rounded-full border border-slate-200 px-2 py-0.5 dark:border-slate-700">
            Propiedad materiales: {r.propiedad_materiales}
          </span>
        )}
        {r.plataforma_provee && (
          <span className="rounded-full border border-slate-200 px-2 py-0.5 dark:border-slate-700">
            Plataforma: {r.plataforma_provee}
          </span>
        )}
        {r.penalidad_factor_f != null && (
          <span className="rounded-full border border-slate-200 px-2 py-0.5 dark:border-slate-700">
            F = {r.penalidad_factor_f}
          </span>
        )}
        {r.penalidad_tope_pct != null && (
          <span className="rounded-full border border-slate-200 px-2 py-0.5 dark:border-slate-700">
            Tope {r.penalidad_tope_pct}%
          </span>
        )}
      </div>
      {r.penalidad_formula && (
        <p className="mb-3 text-[12px] text-slate-500">{r.penalidad_formula}</p>
      )}
      {criticas.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {criticas.map((c, i) => (
            <div key={`${c.clausula}-${i}`} className={`rounded-xl border p-3 ${impactoBorder(c.impacto)}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{c.clausula}</p>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${riesgoCls(c.impacto)}`}>
                  {c.impacto}
                </span>
              </div>
              <p className="mt-1 text-[12px] text-slate-600 dark:text-slate-300">{c.descripcion}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
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
  const extra = detail?.trim()
  const extraCls = tono === 'bad'
    ? 'text-red-700 dark:text-red-300'
    : tono === 'warn'
      ? 'text-amber-800 dark:text-amber-200'
      : 'text-slate-500'
  const showExtra = Boolean(extra) && (tono !== 'ok' || extra !== value)
  return (
    <div className={`rounded-xl border p-3 ${tonoCls(tono)}`}>
      <p className="text-[11px] text-slate-500">{title}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
      {showExtra && extra && <p className={`mt-1 text-[11px] ${extraCls}`}>{extra}</p>}
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
  const [error502, setError502] = useState(false)
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
      setError502(false)
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
        if (res.status === 502) {
          if (ac.signal.aborted) return
          setError502(true)
          return
        }
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
    <div className="mx-auto max-w-6xl space-y-5 px-3 py-5 sm:px-4 text-[var(--text-primary)]">
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
        <h1 className="mt-0.5 text-xl text-[var(--text-primary)] sm:text-2xl">
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

      {error502 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div>
              <p>El análisis no pudo completarse en este momento.</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                El servicio de IA no respondió correctamente. Suele resolverse en segundos.
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-3 rounded-lg bg-teal-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-400"
              >
                Reintentar
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <ErrorBox retry={() => window.location.reload()}>{error}</ErrorBox>
      )}

      {loading && !error502 && (
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
          {a.viabilidad?.ratio_alcance && (
            <InfografiaRatio
              ratio={a.viabilidad.ratio_alcance}
              codigo={a.veredicto.codigo}
              encaje={a.encaje}
              duracion={a.timeline?.duracion_total_texto}
              descalificador={descalificadorDe(a)}
            />
          )}

          <p className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[11px] text-[var(--text-secondary)]">
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

          {(a.alternativas?.length ?? 0) > 0 && (
            <AlternativasBlock key={contratoId} items={a.alternativas!} />
          )}

          <section>
            <h2 className="mb-1 text-sm font-medium">Qué se contrata</h2>
            <p className="text-sm text-slate-700 dark:text-slate-300">{a.resumen}</p>
          </section>

          {(a.componentes_servicio?.length ?? 0) > 1 && (
            <ComponentesTabs items={a.componentes_servicio!} />
          )}

          <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3">
              <p className="text-[11px] text-slate-500">Encaje</p>
              <p className="mt-1 text-sm font-medium">
                {labelRubro(a.encaje.rubro)} · {labelCalifica(a.encaje.califica)}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">Perfil pedido: {a.encaje.perfil_pedido || 'no consta'}</p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{a.encaje.razon}</p>
              {a.requisitos_proveedor && (
                <RequisitosBlock r={a.requisitos_proveedor} />
              )}
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3">
              <p className="text-[11px] text-slate-500">Economía (estimaciones)</p>
              <p className="mt-1 text-sm">Valor est. {soles(a.economia.valor_estimado_soles)}</p>
              <p className="text-sm">Costo est. {soles(a.economia.costo_estimado_soles)}</p>
              <p className="text-sm font-medium">Margen est. {soles(a.economia.margen_soles)}</p>
              <p className="mt-2 text-[11px] text-slate-500">{a.economia.pistas_valor}</p>
              {(a.viabilidad?.cotizacion_por_componente?.length ?? 0) > 0 && (
                <EconomiaPorComponente
                  componentes={a.viabilidad!.cotizacion_por_componente!}
                  techo={a.viabilidad?.ratio_alcance?.techo_contrato ?? data.techo_soles}
                  lectura={a.viabilidad?.ratio_alcance?.lectura}
                />
              )}
            </div>
          </section>

          {(a.timeline?.hitos?.length ?? 0) > 0 && (
            <TimelineCard timeline={a.timeline!} />
          )}

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
                detail={a.condiciones.plazo}
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

          {(a.estructura_contractual?.entregables?.length ?? 0) > 0 && (
            <EntregablesTable items={a.estructura_contractual!.entregables!} />
          )}

          {a.riesgos_contractuales && (
            <RiesgosBlock r={a.riesgos_contractuales} />
          )}

          {(a.viabilidad?.contradicciones_tdr?.length ?? 0) > 0 && (
            <ContradiccionesBlock items={a.viabilidad!.contradicciones_tdr!} />
          )}

          <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3">
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

          {(a.optimizacion || []).filter(s => String(s).trim()).length > 0 && (
            <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3">
              <p className="text-sm font-medium">Cómo mejorar el margen</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-600 dark:text-slate-300">
                {a.optimizacion.filter(s => String(s).trim()).map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </section>
          )}

          <section className="rounded-xl border border-dashed border-slate-300 p-3 dark:border-slate-700">
            <p className="text-sm font-medium">Chat de escenarios</p>
            <p className="mt-1 text-[12px] text-slate-500">
              El análisis de arriba no cambia. Acá se recalcula un escenario con supuestos explícitos.
              El número final lo pone ENERTRONIC.
            </p>
            <ChatEscenarios contratoId={contratoId} chipsIniciales={a.chips_sugeridos ?? undefined} />
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
  type?: 'error'
  escenario?: EscenarioPayload | null
  error?: boolean
  limit?: boolean
  aviso?: boolean
  query?: string
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
  const tipo = e.tipo_respuesta || 'texto'
  const head = e.escenario.replace(/\s+/g, ' ').slice(0, 280)
  if (!escenarioMuestraCifras(e)) {
    return `[${tipo}] ${head}`
  }
  return `[${tipo}] ${head}. Asumiendo: ${e.supuestos_aplicados.join('; ')}`
}

function tablaValida(t: ChatTabla | null | undefined): t is ChatTabla {
  return Boolean(t && Array.isArray(t.columnas) && t.columnas.length && Array.isArray(t.filas) && t.filas.length)
}

function graficaValida(g: ChatGrafica | null | undefined): g is ChatGrafica {
  return Boolean(g && Array.isArray(g.datos) && g.datos.some(d => d && typeof d.valor === 'number'))
}

function ChatMedia({ tabla, grafica }: { tabla: ChatTabla | null; grafica: ChatGrafica | null }) {
  const [tab, setTab] = useState<'tabla' | 'grafica'>('tabla')
  const hasT = tablaValida(tabla)
  const hasG = graficaValida(grafica)
  if (hasT && hasG) {
    return (
      <div className="mt-3">
        <div className="mb-2 flex gap-1 rounded-lg border border-[var(--border)] p-0.5">
          <button
            type="button"
            onClick={() => setTab('tabla')}
            className={`flex-1 rounded-md px-2 py-1 text-xs ${
              tab === 'tabla' ? 'bg-teal-500/15 font-medium text-teal-800 dark:text-teal-200' : 'text-[var(--text-secondary)]'
            }`}
          >
            Tabla
          </button>
          <button
            type="button"
            onClick={() => setTab('grafica')}
            className={`flex-1 rounded-md px-2 py-1 text-xs ${
              tab === 'grafica' ? 'bg-teal-500/15 font-medium text-teal-800 dark:text-teal-200' : 'text-[var(--text-secondary)]'
            }`}
          >
            Gráfica
          </button>
        </div>
        {tab === 'tabla' ? <ChatTable tabla={tabla} /> : <ChatChart grafica={grafica} />}
      </div>
    )
  }
  if (hasT) return <ChatTable tabla={tabla} />
  if (hasG) return <ChatChart grafica={grafica} />
  return null
}

function EscenarioCard({ e }: { e: EscenarioPayload }) {
  const showMontos = escenarioMuestraCifras(e)
  const tabla = tablaValida(e.tabla) ? e.tabla : null
  const grafica = graficaValida(e.grafica) ? e.grafica : null
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3">
      <span className="rounded-full bg-teal-500/15 px-2 py-0.5 text-[11px] font-medium text-teal-700 dark:text-teal-300">
        Escenario estimado
      </span>
      <div className="mt-2">
        <MarkdownRenderer content={e.escenario} className="text-sm" />
      </div>
      <ChatMedia tabla={tabla} grafica={grafica} />
      {e.recomendacion && (
        <div className="mt-3 rounded-lg border border-teal-500/30 bg-teal-500/10 px-3 py-2 text-sm">
          💡 {e.recomendacion}
        </div>
      )}
      {showMontos && (
        <p className="mt-2 text-sm text-slate-800 dark:text-slate-100">
          Valor {soles(e.valor_estimado_soles)} · Costo {soles(e.costo_estimado_soles)} · Margen {soles(e.margen_estimado_soles)}
        </p>
      )}
      {(e.supuestos_aplicados?.length ?? 0) > 0 && (
        <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
          Asumiendo: {e.supuestos_aplicados.join('; ')}.
        </p>
      )}
      {e.nota && <MarkdownRenderer content={e.nota} className="mt-2 text-[11px] text-[var(--text-secondary)]" />}
      {(e.cambio_vs_analisis || (e.sigue_sin_saberse?.length ?? 0) > 0) && (
        <p className="mt-1 text-[11px] text-slate-500">
          {e.cambio_vs_analisis ? `Cambió vs análisis: ${e.cambio_vs_analisis}` : null}
          {(e.sigue_sin_saberse?.length ?? 0) > 0 && (
            <>{e.cambio_vs_analisis ? ' · ' : ''}Sigue sin saberse: {e.sigue_sin_saberse.join('; ')}</>
          )}
        </p>
      )}
    </div>
  )
}

function hydrateEscenario(raw: unknown): EscenarioPayload | null {
  if (!raw || typeof raw !== 'object') return null
  const e = raw as EscenarioPayload
  if (e.tabla && Array.isArray(e.tabla.filas)) {
    e.tabla = {
      ...e.tabla,
      filas: e.tabla.filas.map((row) => {
        if (Array.isArray(row)) return row.map((c) => (c == null ? '' : String(c)))
        if (row && typeof row === 'object' && Array.isArray((row as { celdas?: unknown }).celdas)) {
          return (row as { celdas: unknown[] }).celdas.map((c) => (c == null ? '' : String(c)))
        }
        return []
      }),
    }
  }
  return e
}

function hydrateMsgs(parsed: unknown): EscenaMsg[] {
  if (!Array.isArray(parsed)) return []
  return parsed.slice(-20).map((m) => {
    if (!m || typeof m !== 'object') return null
    const row = m as EscenaMsg
    if (row.escenario) row.escenario = hydrateEscenario(row.escenario)
    return row
  }).filter((m): m is EscenaMsg => Boolean(m && (m.role === 'user' || m.role === 'bot')))
}

function ChatEscenarios({ contratoId, chipsIniciales }: { contratoId: number; chipsIniciales?: string[] }) {
  const STORAGE_KEY = `chat_escenarios_${contratoId}`
  const [messages, setMessages] = useState<EscenaMsg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [skipPersist, setSkipPersist] = useState(false)
  const chips = (chipsIniciales && chipsIniciales.length > 0)
    ? chipsIniciales.map(c => c.trim()).filter(Boolean).map(c => c.slice(0, 40))
    : CHIPS_ESCENARIO
  const showChips = !loading && messages.length === 0

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
          setMessages(hydrateMsgs(JSON.parse(saved)))
        } else {
          setMessages([])
        }
    } catch {
      setMessages([])
    }
    setReady(true)
  }, [STORAGE_KEY])

  useEffect(() => {
    if (!ready || skipPersist) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-20)))
    } catch { /* quota */ }
  }, [messages, ready, STORAGE_KEY, skipPersist])

  function nuevaConsulta() {
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* */ }
    setMessages([])
  }

  async function enviar(texto = input) {
    const q = texto.trim()
    if (!q || loading) return
    setSkipPersist(false)
    const history = buildEscenaHistory(messages)
    setInput('')
    setMessages(m => [...m, { role: 'user', text: q }, { role: 'bot', text: '' }])
    setLoading(true)
    try {
      const res = await fetch(`${AI_PROXY}/cotizar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(contratoId ? { 'X-Contrato-Id': String(contratoId) } : {}),
        },
        body: JSON.stringify({ contrato_id: contratoId, query: q, history }),
      })
      const payload = await (async () => {
        try {
          return await res.json() as {
            escenario?: EscenarioPayload
            status?: string
            mensaje?: string
            error?: string
            respuesta?: string
          }
        } catch {
          return {} as {
            escenario?: EscenarioPayload
            status?: string
            mensaje?: string
            error?: string
            respuesta?: string
          }
        }
      })()
      if (res.status === 502) {
        setMessages(m => {
          const next = [...m]
          next[next.length - 1] = {
            role: 'bot',
            type: 'error',
            error: true,
            query: q,
            text: 'El servicio no respondió correctamente. Podés reintentar la misma pregunta.',
          }
          return next
        })
        return
      }
      if (res.status === 409 && payload.status === 'sin_analisis') {
        setSkipPersist(true)
        try { localStorage.removeItem(STORAGE_KEY) } catch { /* */ }
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
          escenario: hydrateEscenario(e) ?? e,
        }
        return next
      })
    } catch (err) {
      setMessages(m => {
        const next = [...m]
        next[next.length - 1] = {
          role: 'bot',
          type: 'error',
          query: q,
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
            ) : m.escenario ? (
              <EscenarioCard e={m.escenario} />
            ) : (
              <p className="text-xs text-slate-500">{loading && i === messages.length - 1 ? 'Recalculando escenario…' : m.text}</p>
            )}
          </div>
        </div>
      ))}

      {showChips && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => void enviar(s)}
              className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:border-teal-400"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      {!loading && messages.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={nuevaConsulta}
            className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:border-red-300"
          >
            Nueva consulta
          </button>
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
          className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-teal-500 disabled:opacity-50"
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

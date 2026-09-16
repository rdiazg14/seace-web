import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertCircle, Brain, Check, ChevronDown, ChevronRight, CircleGauge, CircleCheckBig, Clock3, Copy, Flag, History, Layers, Loader2, MessageCircle, Trash2, X } from 'lucide-react'
import { supabase, AI_PROXY } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { workerAuthHeaders } from '../lib/workerAuth'
import {
  actualizarSesion,
  borrarSesion,
  cargarMensajes,
  crearSesion,
  guardarMensaje,
  listarSesionesContrato,
  type MensajeChat,
  type SesionChat,
} from '../lib/chatSesiones'
import type { Contrato } from '../types'
import { cierraEn, fmtFecha, fmtFechaHora, nroContrato, seaceUrl, tituloContrato } from '../lib/format'
import {
  labelCalifica,
  labelModalidad,
  labelRubro,
  labelVeredicto,
  soles,
  escenarioMuestraCifras,
  ANALISIS_PROMPT_VERSION,
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
import { CierraPill, EstadoPill, CatItIaPill } from '../components/Pills'
import { BotonVerTdr, BTN_SEACE_SECUNDARIO } from '../components/BotonVerTdr'
import { ErrorBox, Skeleton } from '../components/ui'
import { MarkdownRenderer } from '../components/MarkdownRenderer'
import { TimelineCard } from '../components/TimelineFishbone'
import { ChatTable } from '../components/ChatTable'
import { ChatChart } from '../components/ChatChart'
import { esPorAbrir } from '../lib/rutaDia'
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

function pdfHashFicha(c: Pick<Contrato, 'pdf_hash'>): string {
  return (c.pdf_hash || '').trim() || 'na'
}

async function leerAnalisisPersistido(
  contratoId: number,
  pdfHash: string,
): Promise<AnalisisResponse | null> {
  const { data, error } = await supabase
    .from('analisis_contrato')
    .select('payload, creado_utc')
    .eq('contrato_id', contratoId)
    .eq('pdf_hash', pdfHash)
    .eq('prompt_version', ANALISIS_PROMPT_VERSION)
    .maybeSingle()
  if (error || !data?.payload || typeof data.payload !== 'object') return null
  const payload = data.payload as AnalisisResponse
  if (!payload.analisis) return null
  return { ...payload, analizado_utc: data.creado_utc ?? payload.analizado_utc }
}

function RequisitosBlock({ r }: { r: RequisitosProveedor }) {
  const consorcio = r.admite_consorcio
  const certs = r.certificaciones_especificas
  return (
    <div className="mt-3 border-t border-[var(--border)] pt-3">
      <p className="text-[11px] text-[var(--text-secondary)]">Requisitos del proveedor</p>
      {(r.habilitaciones?.length ?? 0) > 0 && (
        <ul className="mt-1 space-y-0.5 text-[12px] text-[var(--text-secondary)]">
          {r.habilitaciones!.map((h, i) => <li key={i}>✅ {h}</li>)}
        </ul>
      )}
      {r.experiencia_minima && (
        <p className="mt-1 text-[12px] text-[var(--text-secondary)]">✅ {r.experiencia_minima}</p>
      )}
      {Array.isArray(certs) && certs.length === 0 && (
        <span className="mt-2 inline-block rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
          Sin certificaciones específicas requeridas
        </span>
      )}
      {(certs?.length ?? 0) > 0 && (
        <ul className="mt-1 list-disc pl-4 text-[12px] text-[var(--text-secondary)]">
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
      <h2 className="mb-2 text-sm font-medium text-[var(--text-primary)]">Entregables</h2>
      <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
        <table className="w-full min-w-[520px] text-left text-[12px]">
          <thead className="bg-[var(--bg-secondary)] text-[11px] text-[var(--text-secondary)]">
            <tr>
              <th className="px-3 py-2 font-medium">Entregable</th>
              <th className="px-3 py-2 font-medium">Plazo</th>
              <th className="px-3 py-2 font-medium">Referencia</th>
              <th className="px-3 py-2 font-medium">Riesgo</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e, i) => (
              <tr key={`${e.nombre}-${i}`} className="border-t border-[var(--border)]">
                <td className="px-3 py-2">
                  <p className="font-medium text-[var(--text-primary)]">{e.nombre}</p>
                  {e.descripcion && <p className="mt-0.5 text-[var(--text-secondary)]">{e.descripcion}</p>}
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
      <h2 className="mb-2 text-sm font-medium text-[var(--text-primary)]">Riesgos contractuales</h2>
      <div className="mb-3 flex flex-wrap gap-2 text-[11px]">
        {r.propiedad_materiales && (
          <span className="rounded-full border border-[var(--border)] px-2 py-0.5">
            Propiedad materiales: {r.propiedad_materiales}
          </span>
        )}
        {r.plataforma_provee && (
          <span className="rounded-full border border-[var(--border)] px-2 py-0.5">
            Plataforma: {r.plataforma_provee}
          </span>
        )}
        {r.penalidad_factor_f != null && (
          <span className="rounded-full border border-[var(--border)] px-2 py-0.5">
            F = {r.penalidad_factor_f}
          </span>
        )}
        {r.penalidad_tope_pct != null && (
          <span className="rounded-full border border-[var(--border)] px-2 py-0.5">
            Tope {r.penalidad_tope_pct}%
          </span>
        )}
      </div>
      {r.penalidad_formula && (
        <p className="mb-3 text-[12px] text-[var(--text-secondary)]">{r.penalidad_formula}</p>
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
              <p className="mt-1 text-[12px] text-[var(--text-secondary)]">{c.descripcion}</p>
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
      : 'text-[var(--text-secondary)]'
  const showExtra = Boolean(extra) && (tono !== 'ok' || extra !== value)
  return (
    <div className={`rounded-xl border p-3 ${tonoCls(tono)}`}>
      <p className="text-[11px] text-[var(--text-secondary)]">{title}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
      {showExtra && extra && <p className={`mt-1 text-[11px] ${extraCls}`}>{extra}</p>}
    </div>
  )
}

const MIN_PANEL_W = 320
const MAX_PANEL_W = 720
const DEFAULT_PANEL_W = 380
const CHAT_PANEL_STORAGE_KEY = 'seace_chat_panel_width'
const DESKTOP_MQ = '(min-width: 1024px)'

function maxPanelWidth(): number {
  if (typeof window === 'undefined') return MAX_PANEL_W
  return Math.min(MAX_PANEL_W, Math.floor(window.innerWidth * 0.5))
}

function clampPanelWidth(w: number): number {
  return Math.min(maxPanelWidth(), Math.max(MIN_PANEL_W, w))
}

function readSavedPanelWidth(): number {
  try {
    const saved = localStorage.getItem(CHAT_PANEL_STORAGE_KEY)
    if (saved) {
      const n = Number(saved)
      if (Number.isFinite(n) && n > 0) return clampPanelWidth(n)
    }
  } catch { /* quota / private mode */ }
  return DEFAULT_PANEL_W
}

function isDesktopViewport(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(DESKTOP_MQ).matches
}

function useDesktop(): boolean {
  const [desktop, setDesktop] = useState(isDesktopViewport)
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_MQ)
    const apply = () => setDesktop(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])
  return desktop
}

export default function AnalisisContrato() {
  const { id } = useParams()
  const contratoId = Number(id)
  const desktop = useDesktop()
  const [ficha, setFicha] = useState<Contrato | null>(null)
  const [data, setData] = useState<AnalisisResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [error502, setError502] = useState(false)
  const [sinTdr, setSinTdr] = useState<string | null>(null)
  const [sinAnalisis, setSinAnalisis] = useState(false)
  const [chatOpen, setChatOpen] = useState(isDesktopViewport)
  const [panelWidth, setPanelWidth] = useState<number>(() => readSavedPanelWidth())
  const [panelResizing, setPanelResizing] = useState(false)

  useEffect(() => {
    const onResize = () => setPanelWidth(w => clampPanelWidth(w))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const fetchAnalisis = useCallback(async (signal?: AbortSignal) => {
    if (!Number.isFinite(contratoId) || contratoId <= 0) return
    setLoading(true)
    setError(null)
    setError502(false)
    setSinTdr(null)
    setSinAnalisis(false)
    setData(null)
    try {
      const headers = await workerAuthHeaders({ 'Content-Type': 'application/json' })
      const res = await fetch(`${AI_PROXY}/analizar`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ contrato_id: contratoId }),
        signal,
      })
      let payload: AnalisisResponse & {
        error?: string
        respuesta?: string
        status?: string
        mensaje?: string
      }
      try {
        payload = await res.json() as typeof payload
      } catch {
        if (signal?.aborted) return
        if (res.status === 502) {
          setError502(true)
          return
        }
        throw new Error(`HTTP ${res.status}`)
      }
      if (signal?.aborted) return
      if (res.status === 502 || payload.error === 'analisis_fallido') {
        setError502(true)
        return
      }
      if (res.status === 422 && payload.status === 'sin_tdr') {
        setSinTdr(payload.mensaje || 'este contrato no tiene TDR suficiente para analizar')
        return
      }
      if (!res.ok) {
        throw new Error(payload.respuesta || payload.mensaje || `HTTP ${res.status}`)
      }
      if (payload.error && !payload.analisis) {
        throw new Error(payload.mensaje || payload.error)
      }
      setData(payload)
    } catch (e) {
      if ((e as Error).name === 'AbortError' || signal?.aborted) return
      setError(e instanceof Error ? e.message : 'No se pudo analizar')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [contratoId])

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
      setSinAnalisis(false)
      setData(null)
      try {
        const { data: row, error: err } = await supabase
          .from('v_contratos')
          .select('id,nro_contratacion,descripcion_contrato,descripcion,entidad,estado,objeto,nom_area_usuaria,fecha_publica,fecha_fin_cotizacion,tipo_cotizacion,categoria_it,relevancia_ia,pdf_archivo_id,pdf_storage_path,pdf_hash')
          .eq('id', contratoId)
          .maybeSingle()
        if (err) throw err
        if (!row) throw new Error('Contrato no encontrado')
        if (ac.signal.aborted) return
        setFicha(row as Contrato)
        const persistido = await leerAnalisisPersistido(
          (row as Contrato).id,
          pdfHashFicha(row as Contrato),
        )
        if (ac.signal.aborted) return
        if (persistido) {
          setData(persistido)
          setLoading(false)
          return
        }
        // La IA ya pasó una única vez en el pipeline batch (analizar_postulables.py),
        // que escribe en analisis_contrato. La página solo LEE ese resultado.
        // No disparar análisis on-demand al abrir: si no hay análisis guardado,
        // se muestra "sin análisis" y el usuario puede forzarlo manualmente.
        setSinAnalisis(true)
        setLoading(false)
      } catch (e) {
        if ((e as Error).name === 'AbortError' || ac.signal.aborted) return
        setError(e instanceof Error ? e.message : 'No se pudo analizar')
        if (!ac.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => { ac.abort() }
  }, [contratoId, fetchAnalisis])

  useEffect(() => {
    setChatOpen(isDesktopViewport())
  }, [contratoId])

  const a = data?.analisis
  const cierre = cierraEn(ficha?.fecha_fin_cotizacion ?? null)
  const porAbrir = ficha ? esPorAbrir(ficha) : false

  const nro = ficha ? nroContrato(ficha) : (data?.nro || `Contrato ${id}`)

  return (
    <div
      className={panelResizing ? '' : 'transition-[margin-right] duration-[250ms] ease-out'}
      style={{ marginRight: chatOpen && desktop ? panelWidth : 0 }}
    >
    <div className="mx-auto max-w-6xl space-y-5 px-3 py-5 sm:px-4 text-[var(--text-primary)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to="/ruta-dia" className="text-xs font-medium text-teal-600 dark:text-teal-400">
          ← Ruta del día
        </Link>
        {ficha && (
          <div className="flex flex-wrap items-center gap-2">
            <BotonVerTdr
              contratoId={ficha.id}
              pdfArchivoId={ficha.pdf_archivo_id ?? null}
              pdfStoragePath={ficha.pdf_storage_path}
            />
            <a
              href={seaceUrl(ficha.id)}
              target="_blank"
              rel="noreferrer"
              className={BTN_SEACE_SECUNDARIO}
            >
              Ver en SEACE
            </a>
          </div>
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
              <CatItIaPill categoria_it={ficha.categoria_it} relevancia_ia={ficha.relevancia_ia} />
              {porAbrir && ficha.fecha_ini_cotizacion && (
                <CierraPill label={`Abre ${fmtFechaHora(ficha.fecha_ini_cotizacion)}`} tone="abre" />
              )}
              {ficha.fecha_fin_cotizacion && ficha.estado === 'Vigente' && !porAbrir && (
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
            {data?.analizado_utc && (
              <p className="mt-1 text-[11px] text-slate-400">
                Analizado el {fmtFecha(data.analizado_utc)}
              </p>
            )}
          </>
        )}
      </header>

      {sinTdr && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
          {sinTdr}
        </div>
      )}

      {sinAnalisis && !loading && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-slate-500 dark:text-slate-400" />
            <div>
              <p className="font-medium">Este contrato aún no tiene análisis de IA.</p>
              <p className="mt-1 text-[var(--text-secondary)]">
                El análisis se ejecuta una sola vez, de forma automática, en el pipeline diario para los contratos con TDR disponible. Si este contrato es postulable y ya cuenta con TDR, el análisis debería aparecer en la próxima corrida.
              </p>
              <button
                type="button"
                onClick={() => void fetchAnalisis()}
                className="mt-3 rounded-lg border border-teal-500 px-3 py-1.5 text-sm font-medium text-teal-600 hover:bg-teal-500/10 dark:text-teal-400"
              >
                Analizar ahora
              </button>
            </div>
          </div>
        </div>
      )}

      {error502 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-[var(--text-primary)]">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-medium">El análisis no pudo completarse en este momento.</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                El servicio de IA no respondió correctamente. Suele resolverse en unos segundos.
              </p>
              <button
                type="button"
                onClick={() => void fetchAnalisis()}
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
            <h2 className="mb-2 text-sm font-medium text-[var(--text-primary)]">Qué se contrata</h2>
            <p className="text-sm text-[var(--text-secondary)]">{a.resumen}</p>
          </section>

          {(a.componentes_servicio?.length ?? 0) > 1 && (
            <ComponentesTabs items={a.componentes_servicio!} />
          )}

          <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3">
              <p className="text-[11px] text-[var(--text-secondary)]">Encaje</p>
              <p className="mt-1 text-sm font-medium">
                {labelRubro(a.encaje.rubro)} · {labelCalifica(a.encaje.califica)}
              </p>
              <p className="mt-1 text-[11px] text-[var(--text-secondary)]">Perfil pedido: {a.encaje.perfil_pedido || 'no consta'}</p>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">{a.encaje.razon}</p>
              {a.requisitos_proveedor && (
                <RequisitosBlock r={a.requisitos_proveedor} />
              )}
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3">
              <p className="text-[11px] text-[var(--text-secondary)]">Economía (estimaciones)</p>
              <p className="mt-1 text-sm">Valor est. {soles(a.economia.valor_estimado_soles)}</p>
              <p className="text-sm">Costo est. {soles(a.economia.costo_estimado_soles)}</p>
              <p className="text-sm font-medium">Margen est. {soles(a.economia.margen_soles)}</p>
              <p className="mt-2 text-[11px] text-[var(--text-secondary)]">{a.economia.pistas_valor}</p>
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
            <h2 className="mb-2 text-sm font-medium text-[var(--text-primary)]">Condiciones (del TDR)</h2>
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
              <ul className="mt-2 list-disc space-y-1 pl-4 text-[12px] text-[var(--text-secondary)]">
                {(a.economia.supuestos || []).map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
              <p className="text-sm font-medium">Lo que la IA no sabe</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-[12px] text-[var(--text-secondary)]">
                {(a.economia.lo_que_no_sabe || []).map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          </section>

          {(a.optimizacion || []).filter(s => String(s).trim()).length > 0 && (
            <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3">
              <p className="text-sm font-medium">Cómo mejorar el margen</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-[var(--text-secondary)]">
                {a.optimizacion.filter(s => String(s).trim()).map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
      {a && Number.isFinite(contratoId) && contratoId > 0 && (
        <ChatEscenarios
          key={contratoId}
          contratoId={contratoId}
          nro={nro}
          contratoTitulo={ficha ? tituloContrato(ficha) : ''}
          categoriaIt={ficha?.categoria_it ?? undefined}
          chipsIniciales={a.chips_sugeridos ?? undefined}
          open={chatOpen}
          desktop={desktop}
          panelWidth={panelWidth}
          onPanelWidthChange={setPanelWidth}
          onPanelResizeActive={setPanelResizing}
          onOpen={() => setChatOpen(true)}
          onClose={() => setChatOpen(false)}
        />
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
const STREAM_REVEAL_MS = 180

interface EscenaClasificacion {
  necesita_internet: boolean
}

interface UsoTokens {
  prompt: number
  completion: number
  cached?: number
  thoughts?: number
  total?: number
}

/** Metadatos de la respuesta de Gemini (finish reason, versión, latencia, etc.). */
interface GeminiMeta {
  finishReason?: string
  modelVersion?: string
  responseId?: string
  serviceTier?: string
  thinkingLevel?: string
  latencyMs?: number
}

interface EscenaMsg {
  id?: string
  role: 'user' | 'bot'
  text: string
  type?: 'error'
  escenario?: EscenarioPayload | null
  clasificacion?: EscenaClasificacion
  error?: boolean
  limit?: boolean
  aviso?: boolean
  query?: string
  streaming?: boolean
  progress?: boolean
  phase?: 'clasificar' | 'contexto' | 'redactar'
  streamText?: string
  /** Texto SSE acumulado antes del reveal (B5: colapsar antes de mostrar). */
  streamBuffer?: string
  /** Tokens de la generación (prompt + completion), si el backend los devolvió. */
  usage?: UsoTokens | null
  /** Razonamiento interno del modelo (thinking), colapsado con icono de cerebro. */
  thought?: string | null
  /** Modelo que generó la respuesta. */
  model?: string
  /** ID de request (para copiar/reportar). */
  requestId?: string
  /** Metadatos extra de Gemini (finish reason, versión, latencia, tier). */
  meta?: GeminiMeta | null
}

type CotizarSseEvent = {
  type?: string
  phase?: string
  message?: string
  token?: string
  escenario?: EscenarioPayload
  clasificacion?: unknown
  usage?: UsoTokens | null
  thought?: string | null
  model?: string
  meta?: GeminiMeta | null
  models?: string[]
  request_id?: string
  consumido_usd?: number
  presupuesto_usd?: number | null
  saldo_usd?: number | null
}

function parseClasificacion(raw: unknown): EscenaClasificacion | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  return { necesita_internet: o.necesita_internet === true }
}

function newMsgId(): string {
  return crypto.randomUUID()
}

/** Serializa el estado rico de un mensaje bot para guardar en chat_mensajes.payload. */
function payloadBot(m: EscenaMsg): Record<string, unknown> | null {
  if (m.role !== 'bot') return null
  return {
    escenario: m.escenario ?? null,
    clasificacion: m.clasificacion ?? null,
    thought: m.thought ?? null,
    model: m.model ?? null,
    request_id: m.requestId ?? null,
    usage: m.usage ?? null,
    meta: m.meta ?? null,
  }
}

/** Reconstruye un EscenaMsg desde una fila persistida de chat_mensajes. */
function msgDesdeFila(m: MensajeChat): EscenaMsg {
  if (m.rol === 'user') {
    return { id: newMsgId(), role: 'user', text: m.texto }
  }
  const base: EscenaMsg = {
    id: newMsgId(),
    role: 'bot',
    text: m.texto,
    error: m.error,
    limit: m.limit_flag,
  }
  const p = m.payload
  if (p && typeof p === 'object') {
    const escenario = p.escenario ? hydrateEscenario(p.escenario) : null
    base.escenario = escenario
    base.clasificacion = (p.clasificacion && typeof p.clasificacion === 'object')
      ? p.clasificacion as EscenaClasificacion
      : undefined
    base.thought = typeof p.thought === 'string' ? p.thought : null
    base.model = typeof p.model === 'string' ? p.model : undefined
    base.requestId = typeof p.request_id === 'string' ? p.request_id : undefined
    base.usage = (p.usage && typeof p.usage === 'object') ? p.usage as UsoTokens : null
    base.meta = (p.meta && typeof p.meta === 'object') ? p.meta as GeminiMeta : null
    if (escenario && !base.error && !base.limit) {
      base.progress = true
      base.phase = 'redactar'
      base.streamText = escenario.escenario
    }
  }
  return base
}

// Precio USD por 1M tokens (input, output). Debe coincidir con el Worker.
const MODEL_PRECIOS: Record<string, { input: number; output: number }> = {
  'gemini-3.7-flash': { input: 0.75, output: 3.75 },
  'gemini-3.6-flash': { input: 0.75, output: 3.75 },
  'gemini-3.1-flash-lite': { input: 0.25, output: 1.5 },
  'gemini-3.1-pro-preview': { input: 2, output: 12 },
}

const MODEL_LABELS: Record<string, string> = {
  'gemini-3.7-flash': '3.7 Flash',
  'gemini-3.6-flash': '3.6 Flash',
  'gemini-3.1-flash-lite': '3.1 Flash-Lite',
  'gemini-3.1-pro-preview': '3.1 Pro',
}

function labelModelo(m: string | null | undefined): string {
  if (!m) return ''
  return MODEL_LABELS[m] ?? m
}

function usoTokensTotal(u: UsoTokens | null | undefined): number {
  return u ? u.prompt + u.completion + (u.thoughts ?? 0) : 0
}

function costoUsd(u: UsoTokens | null | undefined, model?: string | null): number {
  if (!u) return 0
  const p = MODEL_PRECIOS[model ?? ''] ?? MODEL_PRECIOS['gemini-3.1-flash-lite']
  const outputTokens = u.completion + (u.thoughts ?? 0)
  return (u.prompt / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output
}

function fmtCostoUsd(n: number): string {
  if (n <= 0) return '$0.00'
  if (n < 0.01) return '<$0.01'
  return `$${n.toFixed(3).replace(/\.?0+$/, '')}`
}

function fmtUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  const sign = n < 0 ? '-' : ''
  return `${sign}$${Math.abs(n).toFixed(2)}`
}

function hayMontosReales(e: EscenarioPayload): boolean {
  return e.valor_estimado_soles != null
}

function cambioRelevante(s?: string): string {
  const t = (s || '').trim()
  if (!t || /^(ninguno|ninguna|n\/a|n\.?a\.?|sin cambios?|no (hay|aplica)|—|-)$/i.test(t)) return ''
  return t
}

const ANALISIS_PHASES: { id: NonNullable<EscenaMsg['phase']>; label: string }[] = [
  { id: 'clasificar', label: 'Clasificando tu pregunta...' },
  { id: 'contexto', label: 'Recuperando contexto del contrato...' },
  { id: 'redactar', label: 'Redactando respuesta...' },
]

function AnalizandoBlock({
  phase,
  collapsed,
}: {
  phase: EscenaMsg['phase']
  collapsed: boolean
}) {
  const [open, setOpen] = useState(!collapsed)
  const hasAutoCollapsedRef = useRef(false)

  useEffect(() => {
    if (hasAutoCollapsedRef.current) return
    if (collapsed) {
      setOpen(false)
      hasAutoCollapsedRef.current = true
    }
  }, [collapsed])

  if (collapsed && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-2 flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      >
        <CircleCheckBig className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
        <span>Analizado</span>
      </button>
    )
  }

  const idx = ANALISIS_PHASES.findIndex(p => p.id === phase)

  return (
    <div className="mb-2 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-primary)]">
          {!collapsed && <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-500" />}
          {collapsed && <CircleCheckBig className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />}
          {collapsed ? 'Analizado' : 'Analizando...'}
        </span>
        {collapsed && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            Ocultar
          </button>
        )}
      </div>
      <ul className="mt-1.5 space-y-0.5 text-[11px] text-[var(--text-secondary)]">
        {ANALISIS_PHASES.map((s, si) => {
          const active = !collapsed && s.id === phase
          const doneStep = collapsed || si < idx
          return (
            <li
              key={s.id}
              className={active ? 'font-medium text-[var(--text-primary)]' : ''}
            >
              {doneStep ? '✓' : active ? '●' : '○'} {s.label}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

async function readSseEvents(
  res: Response,
  onEvent: (ev: CotizarSseEvent) => void,
): Promise<void> {
  const reader = res.body?.getReader()
  if (!reader) throw new Error('sin stream')
  const decoder = new TextDecoder()
  let buf = ''
  const consume = (block: string) => {
    const line = block.split('\n').find(l => l.startsWith('data:'))
    if (!line) return
    const payload = line.slice(5).trim()
    if (!payload || payload === '[DONE]') return
    try {
      onEvent(JSON.parse(payload) as CotizarSseEvent)
    } catch {
      /* chunk parcial */
    }
  }
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const parts = buf.split('\n\n')
    buf = parts.pop() ?? ''
    for (const part of parts) consume(part)
  }
  if (buf.trim()) consume(buf)
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

function Razonamiento({ thought }: { thought: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)]/50">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-[var(--text-secondary)]"
      >
        <Brain className="h-4 w-4 shrink-0 text-purple-500 dark:text-purple-400" />
        <span>Razonamiento</span>
        <ChevronRight className={`ml-auto h-4 w-4 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="border-t border-[var(--border)] px-3 py-2">
          <MarkdownRenderer content={thought} className="text-xs text-[var(--text-secondary)]" />
        </div>
      )}
    </div>
  )
}

function RespuestaStats({ m }: { m: EscenaMsg }) {
  const [copied, setCopied] = useState(false)
  const u = m.usage
  const meta = m.meta
  if (!u && !m.model && !m.requestId && !meta) return null
  const total = usoTokensTotal(u)
  const cost = costoUsd(u, m.model)

  const copyId = async () => {
    if (!m.requestId) return
    try {
      await navigator.clipboard.writeText(m.requestId)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* portapapeles no disponible */ }
  }

  const finishLabel = (fr?: string): string => {
    if (!fr) return ''
    const map: Record<string, string> = {
      STOP: 'Completado',
      MAX_TOKENS: 'Límite de tokens',
      SAFETY: 'Filtro de seguridad',
      RECITATION: 'Recitación',
      PROHIBITED_CONTENT: 'Contenido prohibido',
      SPII: 'Datos sensibles',
      OTHER: 'Otro',
    }
    return map[fr] ?? fr
  }

  const fmtLatencia = (ms?: number): string => {
    if (typeof ms !== 'number') return ''
    if (ms < 1000) return `${ms} ms`
    return `${(ms / 1000).toFixed(2)} s`
  }

  return (
    <details className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)]/50">
      <summary className="flex cursor-pointer select-none items-center gap-2 px-3 py-2 text-xs font-medium text-[var(--text-secondary)]">
        <span>Estadísticas de la respuesta</span>
        <span className="text-[10px] text-slate-400">⚡ {total.toLocaleString('es-PE')} tokens · {fmtCostoUsd(cost)}</span>
      </summary>
      <div className="space-y-1 border-t border-[var(--border)] px-3 py-2 text-xs text-[var(--text-secondary)]">
        {m.model && (
          <div className="flex justify-between gap-3">
            <span>Modelo</span>
            <span className="font-medium text-[var(--text-primary)]">{labelModelo(m.model)}</span>
          </div>
        )}
        {u && (
          <>
            <div className="flex justify-between gap-3"><span>Input tokens</span><span>{u.prompt.toLocaleString('es-PE')}</span></div>
            <div className="flex justify-between gap-3"><span>Output tokens</span><span>{u.completion.toLocaleString('es-PE')}</span></div>
            {typeof u.thoughts === 'number' && u.thoughts > 0 && (
              <div className="flex justify-between gap-3"><span>Thinking tokens</span><span>{u.thoughts.toLocaleString('es-PE')}</span></div>
            )}
            {typeof u.cached === 'number' && u.cached > 0 && (
              <div className="flex justify-between gap-3"><span>Cached input tokens</span><span>{u.cached.toLocaleString('es-PE')}</span></div>
            )}
            {typeof u.total === 'number' && u.total > 0 && (
              <div className="flex justify-between gap-3 border-t border-[var(--border)] pt-1">
                <span className="font-medium">Total tokens</span>
                <span className="font-medium text-[var(--text-primary)]">{u.total.toLocaleString('es-PE')}</span>
              </div>
            )}
          </>
        )}
        {meta && (
          <>
            {meta.thinkingLevel && (
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5"><CircleGauge className="h-3.5 w-3.5" />Nivel de razonamiento</span>
                <span className="font-medium text-[var(--text-primary)]">{meta.thinkingLevel === 'low' ? 'Bajo (low)' : meta.thinkingLevel}</span>
              </div>
            )}
            {meta.finishReason && (
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5"><Flag className="h-3.5 w-3.5" />Finalización</span>
                <span>{finishLabel(meta.finishReason)}</span>
              </div>
            )}
            {typeof meta.latencyMs === 'number' && (
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />Latencia</span>
                <span>{fmtLatencia(meta.latencyMs)}</span>
              </div>
            )}
            {meta.serviceTier && (
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5"><Layers className="h-3.5 w-3.5" />Tier de servicio</span>
                <span>{meta.serviceTier}</span>
              </div>
            )}
            {meta.modelVersion && (
              <div className="flex justify-between gap-3">
                <span>Versión del modelo</span>
                <span className="truncate font-mono text-[10px]" title={meta.modelVersion}>{meta.modelVersion}</span>
              </div>
            )}
          </>
        )}
        {m.requestId && (
          <div className="flex items-center justify-between gap-3">
            <span className="truncate font-mono text-[10px]" title={m.requestId}>req {m.requestId.slice(0, 8)}…</span>
            <button
              type="button"
              onClick={copyId}
              className="flex items-center gap-1 text-teal-600 hover:text-teal-500 dark:text-teal-400"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copiado' : 'Copiar ID'}
            </button>
          </div>
        )}
      </div>
    </details>
  )
}

function EscenarioCard({ e }: { e: EscenarioPayload }) {
  const marco = hayMontosReales(e)
  const tabla = tablaValida(e.tabla) ? e.tabla : null
  const grafica = graficaValida(e.grafica) ? e.grafica : null
  const cambio = cambioRelevante(e.cambio_vs_analisis)
  const supuestos = marco ? (e.supuestos_aplicados || []).filter(s => String(s).trim()) : []
  const sigue = (e.sigue_sin_saberse || []).filter(s => String(s).trim())
  const nota = marco ? (e.nota || '').trim() : ''

  const body = (
    <>
      <MarkdownRenderer content={e.escenario} className="text-sm" />
      <ChatMedia tabla={tabla} grafica={grafica} />
      {e.recomendacion && (
        <div className="mt-3 rounded-lg border border-teal-500/30 bg-teal-500/10 px-3 py-2 text-sm">
          💡 {e.recomendacion}
        </div>
      )}
    </>
  )

  if (!marco) {
    return (
      <div className="min-w-0">
        {body}
        {sigue.length > 0 && (
          <p className="mt-2 text-[11px] text-slate-500">
            Sigue sin saberse: {sigue.join('; ')}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="min-w-0 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3">
      <span className="rounded-full bg-teal-500/15 px-2 py-0.5 text-[11px] font-medium text-teal-700 dark:text-teal-300">
        Escenario estimado
      </span>
      <div className="mt-2">{body}</div>
      <p className="mt-2 text-sm text-slate-800 dark:text-slate-100">
        Valor {soles(e.valor_estimado_soles)} · Costo {soles(e.costo_estimado_soles)} · Margen {soles(e.margen_estimado_soles)}
      </p>
      {supuestos.length > 0 && (
        <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
          Asumiendo: {supuestos.join('; ')}.
        </p>
      )}
      {nota && <MarkdownRenderer content={nota} className="mt-2 text-[11px] text-[var(--text-secondary)]" />}
      {(cambio || sigue.length > 0) && (
        <p className="mt-1 text-[11px] text-slate-500">
          {cambio ? `Cambió vs análisis: ${cambio}` : null}
          {sigue.length > 0 && (
            <>{cambio ? ' · ' : ''}Sigue sin saberse: {sigue.join('; ')}</>
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

function ChatEscenarios({
  contratoId,
  nro,
  contratoTitulo,
  categoriaIt,
  chipsIniciales,
  open,
  desktop,
  panelWidth,
  onPanelWidthChange,
  onPanelResizeActive,
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
  onPanelWidthChange: (w: number) => void
  onPanelResizeActive: (active: boolean) => void
  onOpen: () => void
  onClose: () => void
}) {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user?.id ?? null
  const [messages, setMessages] = useState<EscenaMsg[]>([])
  const [sesionId, setSesionId] = useState<string | null>(null)
  const [sesiones, setSesiones] = useState<SesionChat[]>([])
  const [historialAbierto, setHistorialAbierto] = useState(false)
  const [cargandoSesion, setCargandoSesion] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [hintFab, setHintFab] = useState(false)
  const [modelos, setModelos] = useState<string[]>([
    'gemini-3.1-flash-lite',
    'gemini-3.7-flash',
    'gemini-3.1-pro-preview',
  ])
  const [modelo, setModelo] = useState<string>('gemini-3.1-flash-lite')
  const [usoGlobal, setUsoGlobal] = useState<{ consumido_usd: number; saldo_usd: number | null }>({
    consumido_usd: 0,
    saldo_usd: null,
  })
  const listRef = useRef<HTMLDivElement>(null)
  const streamRevealTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const chips = (chipsIniciales && chipsIniciales.length > 0)
    ? chipsIniciales.map(c => c.trim()).filter(Boolean).map(c => c.slice(0, 40))
    : CHIPS_ESCENARIO
  const showChips = !loading && messages.length === 0 && !cargandoSesion

  const totalTokens = messages.reduce(
    (acc, m) => acc + (m.role === 'bot' ? usoTokensTotal(m.usage) : 0),
    0,
  )
  const totalCosto = messages.reduce(
    (acc, m) => acc + (m.role === 'bot' ? costoUsd(m.usage, m.model) : 0),
    0,
  )

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
    if (streamRevealTimer.current) {
      clearTimeout(streamRevealTimer.current)
      streamRevealTimer.current = null
    }
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
    if (streamRevealTimer.current) {
      clearTimeout(streamRevealTimer.current)
      streamRevealTimer.current = null
    }
  }, [contratoId])

  useEffect(() => () => {
    if (streamRevealTimer.current) clearTimeout(streamRevealTimer.current)
  }, [])

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

  function onPanelResizeMouseDown(e: ReactMouseEvent) {
    if (!desktop) return
    e.preventDefault()
    let latestW = panelWidth
    onPanelResizeActive(true)
    document.body.style.userSelect = 'none'

    const onMove = (ev: MouseEvent) => {
      latestW = clampPanelWidth(window.innerWidth - ev.clientX)
      onPanelWidthChange(latestW)
    }

    const onUp = () => {
      document.body.style.userSelect = ''
      onPanelResizeActive(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      try {
        localStorage.setItem(CHAT_PANEL_STORAGE_KEY, String(latestW))
      } catch { /* quota */ }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function irChatRagConInternet(pregunta: string) {
    const params = new URLSearchParams()
    params.set('q', pregunta)
    params.set('nro', nro)
    params.set('titulo', contratoTitulo.slice(0, 160))
    if (categoriaIt) params.set('cat', categoriaIt)
    navigate(`/chat?${params.toString()}`)
  }

  async function enviar(texto = input) {
    const q = texto.trim()
    if (!q || loading || !userId) return
    const history = buildEscenaHistory(messages)
    setInput('')
    const botId = newMsgId()
    // Mensaje bot rastreado de forma SÍNCRONA: React aplaza los updaters de
    // setState, por lo que leer el estado dentro de un updater para guardar en
    // BD era racy y perdía respuestas al refrescar.
    let botMsg: EscenaMsg = {
      id: botId,
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
    const patchBot = (upd: Partial<EscenaMsg> | ((prev: EscenaMsg) => EscenaMsg)) => {
      // Rastrea síncronamente el estado real del mensaje bot, fuera del updater
      // de React, para poder guardarlo en BD al final sin depender del render.
      const prevBot = botMsg
      const resolved = typeof upd === 'function' ? upd(prevBot) : { ...prevBot, ...upd }
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

    const scheduleStreamReveal = () => {
      if (streamRevealTimer.current) return
      streamRevealTimer.current = setTimeout(() => {
        streamRevealTimer.current = null
        patchBot(prev => {
          if (!prev.streamBuffer) return prev
          return {
            ...prev,
            streamText: (prev.streamText || '') + prev.streamBuffer,
            streamBuffer: undefined,
          }
        })
      }, STREAM_REVEAL_MS)
    }

    const flushStreamReveal = () => {
      if (streamRevealTimer.current) {
        clearTimeout(streamRevealTimer.current)
        streamRevealTimer.current = null
      }
      patchBot(prev => {
        if (!prev.streamBuffer) return prev
        return {
          ...prev,
          streamText: (prev.streamText || '') + prev.streamBuffer,
          streamBuffer: undefined,
        }
      })
    }

    if (streamRevealTimer.current) {
      clearTimeout(streamRevealTimer.current)
      streamRevealTimer.current = null
    }

    const failBot = (text: string, extra: Partial<EscenaMsg> = {}) => {
      if (streamRevealTimer.current) {
        clearTimeout(streamRevealTimer.current)
        streamRevealTimer.current = null
      }
      patchBot({
        role: 'bot',
        text,
        streaming: false,
        progress: false,
        streamText: '',
        streamBuffer: undefined,
        escenario: null,
        ...extra,
      })
    }

    try {
      const headers = await workerAuthHeaders({
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(contratoId ? { 'X-Contrato-Id': String(contratoId) } : {}),
      })
      const res = await fetch(`${AI_PROXY}/cotizar`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ contrato_id: contratoId, query: q, history, model: modelo }),
      })
      const ct = res.headers.get('content-type') || ''
      const isSse = ct.includes('text/event-stream')

      type CotizarJson = {
        escenario?: EscenarioPayload
        clasificacion?: unknown
        status?: string
        mensaje?: string
        error?: string
        layer?: string
        respuesta?: string
        usage?: UsoTokens | null
        thought?: string | null
        model?: string
        meta?: GeminiMeta | null
        models?: string[]
        request_id?: string
        consumido_usd?: number
        presupuesto_usd?: number | null
        saldo_usd?: number | null
      }

      const applyMeta = (p: CotizarJson) => {
        if (p.models && p.models.length) setModelos(p.models)
        if (p.model) setModelo(p.model)
        setUsoGlobal({
          consumido_usd: p.consumido_usd ?? 0,
          saldo_usd: p.saldo_usd ?? null,
        })
      }

      const applyJson = (payload: CotizarJson) => {
        if (res.status === 502) {
          const capa = payload.layer === 'gemini'
            ? 'El servicio de IA (Gemini) no respondió correctamente.'
            : payload.layer === 'supabase'
              ? 'No se pudo leer el análisis desde la base de datos.'
              : 'El servicio no respondió correctamente.'
          failBot(`${capa} Podés reintentar la misma pregunta.`, {
            type: 'error',
            error: true,
            query: q,
          })
          return
        }
        if (res.status === 409 && payload.status === 'sin_analisis') {
          failBot(
            payload.mensaje || 'Analizá el contrato primero. Recargá esta página y esperá a que termine el análisis.',
            { aviso: true },
          )
          return
        }
        if (res.status === 429 || res.status === 503
          || payload.error === 'rate_limited'
          || payload.error === 'daily_limited'
          || payload.error === 'over_capacity') {
          failBot(
            payload.respuesta || payload.mensaje
              || (res.status === 503
                ? 'Hay alta demanda en el asistente. Intenta más tarde.'
                : 'Has hecho demasiadas consultas. Espera un minuto e intenta de nuevo.'),
            { limit: true },
          )
          return
        }
        if (!res.ok || !payload.escenario) {
          throw new Error(payload.respuesta || payload.error || `HTTP ${res.status}`)
        }
        const e = hydrateEscenario(payload.escenario) ?? payload.escenario
        patchBot({
          streaming: false,
          progress: true,
          text: botHistoryText(e),
          escenario: e,
          clasificacion: parseClasificacion(payload.clasificacion),
          streamText: e.escenario,
          streamBuffer: undefined,
          usage: payload.usage ?? null,
          thought: payload.thought ?? null,
          model: payload.model,
          meta: payload.meta ?? null,
          requestId: payload.request_id,
        })
        applyMeta(payload)
      }

      if (!isSse || !res.ok) {
        let payload: CotizarJson = {}
        try {
          payload = await res.json() as CotizarJson
        } catch {
          payload = {}
        }
        applyJson(payload)
        return
      }

      let gotData = false
      let streamErr: string | null = null
      await readSseEvents(res, (ev) => {
        if (ev.type === 'phase') {
          const phase = ev.phase === 'contexto' || ev.phase === 'redactar' || ev.phase === 'clasificar'
            ? ev.phase
            : 'clasificar'
          patchBot({ phase })
          return
        }
        if (ev.type === 'text' && ev.token) {
          patchBot(prev => {
            if (!prev.streamText) {
              scheduleStreamReveal()
              return {
                ...prev,
                streamBuffer: (prev.streamBuffer || '') + ev.token,
              }
            }
            return {
              ...prev,
              streamText: (prev.streamText || '') + ev.token,
            }
          })
          return
        }
        if (ev.type === 'data' && ev.escenario) {
          gotData = true
          flushStreamReveal()
          const e = hydrateEscenario(ev.escenario) ?? ev.escenario
          patchBot({
            streaming: false,
            progress: true,
            text: botHistoryText(e),
            escenario: e,
            clasificacion: parseClasificacion(ev.clasificacion),
            streamText: e.escenario,
            streamBuffer: undefined,
            usage: ev.usage ?? null,
            thought: ev.thought ?? null,
            model: ev.model,
            meta: ev.meta ?? null,
            requestId: ev.request_id,
          })
          applyMeta(ev)
          return
        }
        if (ev.type === 'error') {
          streamErr = ev.message && /gemini|HTTP 5\d\d/i.test(ev.message)
            ? 'El servicio no respondió correctamente. Podés reintentar la misma pregunta.'
            : (ev.message || 'No pude recalcular el escenario')
        }
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
      const b = botFinal
      const tokens = usoTokensTotal(b.usage)
      const n = messages.length + 2
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
        const acu = { prompt: 0, completion: 0 }
        for (const m of messages) {
          if (m.role === 'bot' && m.usage) {
            acu.prompt += m.usage.prompt
            acu.completion += m.usage.completion
          }
        }
        acu.prompt += b.usage?.prompt ?? 0
        acu.completion += b.usage?.completion ?? 0
        await actualizarSesion(sid, {
          tokens_prompt: acu.prompt,
          tokens_completion: acu.completion,
          n_mensajes: n,
        })
        void refrescarSesiones()
      } catch (e) {
        console.error('guardar bot contrato', e, tokens)
      }
    }
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
            onMouseDown={onPanelResizeMouseDown}
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
              onClick={() => setHistorialAbierto(v => !v)}
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
                          collapsed={Boolean(m.streamBuffer || m.streamText || m.escenario)}
                        />
                      )}
                      {m.thought && !m.streaming && <Razonamiento thought={m.thought} />}
                      {m.escenario ? (
                        <EscenarioCard e={m.escenario} />
                      ) : m.streamText ? (
                        <MarkdownRenderer content={m.streamText} className="text-sm" />
                      ) : null}
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
            className="flex gap-2"
            onSubmit={e => { e.preventDefault(); void enviar() }}
          >
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={loading}
              placeholder="¿Y si…?"
              className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-teal-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="shrink-0 rounded-xl bg-teal-500 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              Enviar
            </button>
          </form>
        </footer>
      </aside>
    </>
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

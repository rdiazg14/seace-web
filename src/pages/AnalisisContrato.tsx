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
  type AnalisisResponse,
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
            <p className="text-sm font-medium">Chat de mejora</p>
            <p className="mt-1 text-[12px] text-slate-500">
              Próxima fase (memoria de conversación). Aquí podrás preguntar «¿y si uso instancias chicas?» y recalcular.
              Por ahora el análisis de arriba es el veredicto inicial.
            </p>
          </section>
        </>
      )}
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

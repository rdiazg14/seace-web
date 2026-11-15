import { Eye, EyeOff } from 'lucide-react'
import type { Contrato, Etapa } from '../types'
import { Modal } from './Modal'
import { EstadoPill } from './Pills'
import { fmtFecha, fmtFechaHora, nroContrato, parseIso, seaceUrl, tituloContrato } from '../lib/format'
import { esEtapaConsultas } from '../features/rutadia/model'
import {
  ordinalConvocatoria,
  resultadoDe,
  type ConvocatoriaFila,
  type ResumenConvocatorias,
} from '../features/rutadia/convocatorias'
import { BotonVerTdr } from './BotonVerTdr'

type EstadoEtapa = 'abierta' | 'futura' | 'cerrada' | 'sin'

function estadoEtapa(e: Etapa, ahora: number): EstadoEtapa {
  const ini = parseIso(e.fec_ini ?? null)?.getTime()
  const fin = parseIso(e.fec_fin ?? null)?.getTime()
  if (ini == null && fin == null) return 'sin'
  if (ini != null && ahora < ini) return 'futura'
  if (fin != null && ahora > fin) return 'cerrada'
  return 'abierta'
}

const ESTADO_ETAPA_CLS: Record<EstadoEtapa, string> = {
  abierta: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  futura: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  cerrada: 'bg-slate-500/15 text-slate-500 dark:text-slate-400',
  sin: 'bg-slate-500/10 text-slate-400',
}

const ESTADO_ETAPA_LABEL: Record<EstadoEtapa, string> = {
  abierta: 'Abierta',
  futura: 'Por abrir',
  cerrada: 'Cerrada',
  sin: 'Sin fecha',
}

function Campo({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-[var(--text-secondary)]">{label}</p>
      <p className="break-words text-sm text-[var(--text-primary)]">{value}</p>
    </div>
  )
}

/** Control segmentado compacto: Visible / Oculto. Vive arriba, pegado a la derecha. */
function SegmentedVisibilidad({
  oculto,
  onChange,
}: {
  oculto: boolean
  onChange: (oculto: boolean) => void
}) {
  const seg = (val: boolean, label: string, icon: React.ReactNode) => {
    const active = oculto === val
    return (
      <label
        title={val ? 'Ocultar convocatoria' : 'Mantener visible'}
        className={`flex cursor-pointer select-none items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
          active
            ? 'bg-teal-500 text-white'
            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
        }`}
      >
        <input
          type="radio"
          name="visibilidad"
          checked={active}
          onChange={() => onChange(val)}
          className="sr-only"
        />
        {icon}
        <span className="hidden sm:inline">{label}</span>
      </label>
    )
  }
  return (
    <div
      role="radiogroup"
      aria-label="Visibilidad de la convocatoria"
      className="inline-flex shrink-0 overflow-hidden rounded-lg border border-[var(--border)]"
    >
      {seg(false, 'Visible', <Eye className="h-3.5 w-3.5" />)}
      {seg(true, 'Oculto', <EyeOff className="h-3.5 w-3.5" />)}
    </div>
  )
}

function Cronograma({ etapas }: { etapas: Etapa[] }) {
  const ahora = Date.now()
  return (
    <ol className="space-y-2">
      {etapas.map((e, i) => {
        const st = estadoEtapa(e, ahora)
        const consulta = esEtapaConsultas(e.etapa)
        return (
          <li
            key={i}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 text-sm font-medium leading-snug text-[var(--text-primary)]">
                {e.etapa ?? '—'}
                {consulta && (
                  <span className="ml-1.5 inline-block rounded-full bg-amber-500/15 px-1.5 py-0.5 align-middle text-[10px] font-medium text-amber-700 dark:text-amber-400">
                    consultas
                  </span>
                )}
              </span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${ESTADO_ETAPA_CLS[st]}`}>
                {ESTADO_ETAPA_LABEL[st]}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-[var(--text-secondary)]">
              <span className="font-mono">Inicio {fmtFechaHora(e.fec_ini ?? null)}</span>
              <span className="font-mono">Fin {fmtFechaHora(e.fec_fin ?? null)}</span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">{titulo}</h3>
      {children}
    </section>
  )
}

const FMT_SOLES = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' })

function ResultadoConvocatoria({ fila }: { fila: ConvocatoriaFila }) {
  const r = resultadoDe(fila)
  if (r === 'desierto') {
    return (
      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:text-emerald-300">
        Desierta
      </span>
    )
  }
  if (r === 'adjudicado') {
    const monto = fila.monto_adjudicado != null && !Number.isNaN(Number(fila.monto_adjudicado))
      ? FMT_SOLES.format(Number(fila.monto_adjudicado))
      : null
    return (
      <span className="text-[11px] text-[var(--text-primary)]">
        <span className="rounded-full bg-sky-500/15 px-2 py-0.5 font-medium text-sky-800 dark:text-sky-300">Adjudicada</span>
        {(fila.proveedor_ganador || monto) && (
          <span className="ml-1.5 text-[var(--text-secondary)]">
            {[fila.proveedor_ganador, monto].filter(Boolean).join(' · ')}
          </span>
        )}
      </span>
    )
  }
  return (
    <span className="rounded-full bg-slate-500/15 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
      {fila.estado === 'Vigente' ? 'En curso' : fila.estado === 'En Evaluación' ? 'En evaluación' : 'Sin resultado'}
    </span>
  )
}

/** Historial del requerimiento: cada vez que la entidad lo convocó y cómo terminó. */
function Convocatorias({ resumen }: { resumen: ResumenConvocatorias }) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-[var(--text-secondary)]">
        Este proceso es la {ordinalConvocatoria(resumen.numero)} convocatoria de {resumen.total}. Se agrupan
        los procesos de la misma entidad con la misma descripción.
        {resumen.desiertasPrevias > 0 && ' Una convocatoria anterior desierta suele indicar poca competencia.'}
      </p>
      <ol className="space-y-2">
        {resumen.filas.map((f) => (
          <li
            key={f.convocatoria_id}
            className={`rounded-lg border px-3 py-2 ${
              f.es_actual ? 'border-teal-400/60 bg-teal-500/5' : 'border-[var(--border)] bg-[var(--bg-card)]'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0 text-sm font-medium text-[var(--text-primary)]">
                {ordinalConvocatoria(f.numero)}
                <span className="ml-2 font-mono text-xs font-normal">
                  {nroContrato({
                    descripcion_contrato: f.descripcion_contrato ?? '',
                    nro_contratacion: f.nro_contratacion ?? '',
                    id: f.convocatoria_id,
                  })}
                </span>
                {f.es_actual && (
                  <span className="ml-2 rounded-full bg-teal-500/15 px-1.5 py-0.5 text-[10px] font-medium text-teal-700 dark:text-teal-300">
                    este proceso
                  </span>
                )}
              </span>
              <ResultadoConvocatoria fila={f} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--text-secondary)]">
              <span className="font-mono">Publicada {fmtFecha(f.fecha_publica)}</span>
              <span className="font-mono">
                Cotización {fmtFechaHora(f.fecha_ini_cotizacion)} – {fmtFechaHora(f.fecha_fin_cotizacion)}
              </span>
              {!f.es_actual && (
                <span className="ml-auto flex flex-wrap items-center gap-2">
                  <BotonVerTdr
                    contratoId={f.convocatoria_id}
                    pdfArchivoId={f.pdf_archivo_id}
                    pdfStoragePath={f.pdf_storage_path}
                  />
                  <a
                    href={seaceUrl(f.convocatoria_id)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-[var(--border)] px-2.5 py-1 font-medium hover:border-teal-400 hover:text-[var(--text-primary)]"
                  >
                    Ver en SEACE ↗
                  </a>
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

export default function ContratoDetallePanel({
  contrato,
  oculto,
  convocatorias = null,
  onToggleOculto,
  onClose,
}: {
  contrato: Contrato
  oculto: boolean
  convocatorias?: ResumenConvocatorias | null
  onToggleOculto: (oculto: boolean) => void
  onClose: () => void
}) {
  const c = contrato
  const etapas = Array.isArray(c.etapas_json) ? c.etapas_json : []
  const conDetalle = c.detalle_cargado === true

  return (
    <Modal open onClose={onClose} title="Detalle del contrato" wide>
      <div className="space-y-5 text-[var(--text-primary)]">
        {/* Encabezado: título + control de visibilidad arriba a la derecha */}
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <h2 className="min-w-0 text-base font-medium leading-snug">{tituloContrato(c)}</h2>
            <SegmentedVisibilidad oculto={oculto} onChange={onToggleOculto} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-slate-100 px-2 py-0.5 font-mono text-sm font-medium text-slate-800 dark:bg-slate-800 dark:text-slate-100">
              {nroContrato(c)}
            </span>
            <EstadoPill estado={c.estado} />
            {c.objeto && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {c.objeto}
              </span>
            )}
            <a
              href={seaceUrl(c.id)}
              target="_blank"
              rel="noreferrer"
              className="ml-auto rounded-lg border border-[var(--border)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:border-teal-400 hover:text-[var(--text-primary)]"
            >
              Ver en SEACE ↗
            </a>
          </div>
        </div>

        {/* Datos generales */}
        <Seccion titulo="Datos generales">
          <div className="grid gap-3 rounded-lg border border-[var(--border)] p-3 sm:grid-cols-2">
            <Campo label="Entidad" value={c.entidad} />
            <Campo label="Área usuaria" value={c.nom_area_usuaria} />
            <Campo label="Tipo de cotización" value={c.tipo_cotizacion ?? undefined} />
            <Campo label="¿Cotizar?" value={c.cotizar === true ? 'Sí' : c.cotizar === false ? 'No' : undefined} />
            <Campo label="Publicación" value={fmtFecha(c.fecha_publica)} />
            <Campo label="Inicio de cotización" value={fmtFechaHora(c.fecha_ini_cotizacion)} />
            <Campo label="Cierre de cotización" value={fmtFechaHora(c.fecha_fin_cotizacion)} />
          </div>
        </Seccion>

        {convocatorias && (
          <Seccion titulo="Convocatorias de este requerimiento">
            <Convocatorias resumen={convocatorias} />
          </Seccion>
        )}

        {/* Cronograma */}
        <Seccion titulo="Cronograma de etapas">
          {!conDetalle ? (
            <p className="text-sm text-[var(--text-secondary)]">Detalle aún no cargado para este contrato.</p>
          ) : etapas.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">Sin cronograma de etapas registrado.</p>
          ) : (
            <Cronograma etapas={etapas} />
          )}
        </Seccion>
      </div>
    </Modal>
  )
}

import type { Contrato, Etapa, ItemCubso } from '../types'
import { Modal } from './Modal'
import { EstadoPill } from './Pills'
import { fmtFecha, fmtFechaHora, nroContrato, parseIso, seaceUrl, tituloContrato } from '../lib/format'
import { esEtapaConsultas } from '../lib/rutaDia'

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
    <div>
      <p className="text-[11px] text-[var(--text-secondary)]">{label}</p>
      <p className="text-sm text-[var(--text-primary)]">{value}</p>
    </div>
  )
}

function RadioOculto({
  oculto,
  onChange,
}: {
  oculto: boolean
  onChange: (oculto: boolean) => void
}) {
  const opt = (val: boolean, label: string, desc: string) => {
    const active = oculto === val
    return (
      <label
        className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 transition-colors ${
          active
            ? 'border-teal-500/60 bg-teal-500/10'
            : 'border-[var(--border)] hover:border-teal-400/50'
        }`}
      >
        <input
          type="radio"
          name="oculto"
          checked={active}
          onChange={() => onChange(val)}
          className="mt-0.5 h-4 w-4 accent-teal-500"
        />
        <span className="min-w-0">
          <span className="block text-sm font-medium text-[var(--text-primary)]">{label}</span>
          <span className="block text-[11px] text-[var(--text-secondary)]">{desc}</span>
        </span>
      </label>
    )
  }
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-[11px] font-medium text-[var(--text-secondary)]">
        Visibilidad de la convocatoria
      </legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {opt(false, 'Visible', 'Se muestra en Postulables.')}
        {opt(true, 'Oculto', 'Se mueve a la sección inferior de ocultos.')}
      </div>
    </fieldset>
  )
}

function TablaEtapas({ etapas }: { etapas: Etapa[] }) {
  const ahora = Date.now()
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="bg-[var(--bg-secondary)] text-[11px] text-[var(--text-secondary)]">
          <tr>
            <th className="px-3 py-2 font-medium">Etapa</th>
            <th className="px-3 py-2 font-medium">Inicio</th>
            <th className="px-3 py-2 font-medium">Fin</th>
            <th className="px-3 py-2 font-medium">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {etapas.map((e, i) => {
            const st = estadoEtapa(e, ahora)
            const consulta = esEtapaConsultas(e.etapa)
            return (
              <tr key={i}>
                <td className="px-3 py-2 text-[var(--text-primary)]">
                  {e.etapa ?? '—'}
                  {consulta && (
                    <span className="ml-1.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                      consultas
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-[var(--text-secondary)]">{fmtFechaHora(e.fec_ini ?? null)}</td>
                <td className="px-3 py-2 font-mono text-xs text-[var(--text-secondary)]">{fmtFechaHora(e.fec_fin ?? null)}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ESTADO_ETAPA_CLS[st]}`}>
                    {ESTADO_ETAPA_LABEL[st]}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function TablaItems({ items }: { items: ItemCubso[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="bg-[var(--bg-secondary)] text-[11px] text-[var(--text-secondary)]">
          <tr>
            <th className="px-3 py-2 font-medium">CUBSO</th>
            <th className="px-3 py-2 font-medium">Ítem</th>
            <th className="px-3 py-2 text-right font-medium">Cant.</th>
            <th className="px-3 py-2 font-medium">Unidad</th>
            <th className="px-3 py-2 font-medium">Distrito</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {items.map((it, i) => (
            <tr key={i}>
              <td className="px-3 py-2 font-mono text-xs text-[var(--text-secondary)]">{it.cod_cubso ?? '—'}</td>
              <td className="px-3 py-2 text-[var(--text-primary)]">
                <span className="block">{it.nom_cubso ?? it.descripcion ?? '—'}</span>
                {it.descripcion && it.nom_cubso && (
                  <span className="block text-[11px] text-[var(--text-secondary)]">{it.descripcion}</span>
                )}
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs text-[var(--text-primary)]">
                {it.cantidad != null ? String(it.cantidad) : '—'}
              </td>
              <td className="px-3 py-2 text-xs text-[var(--text-secondary)]">{it.unidad ?? '—'}</td>
              <td className="px-3 py-2 text-xs text-[var(--text-secondary)]">{it.distrito ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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

export default function ContratoDetallePanel({
  contrato,
  oculto,
  onToggleOculto,
  onClose,
}: {
  contrato: Contrato
  oculto: boolean
  onToggleOculto: (oculto: boolean) => void
  onClose: () => void
}) {
  const c = contrato
  const etapas = Array.isArray(c.etapas_json) ? c.etapas_json : []
  const items = Array.isArray(c.items_json) ? c.items_json : []
  const conDetalle = c.detalle_cargado === true

  return (
    <Modal open onClose={onClose} title="Detalle del contrato" wide>
      <div className="space-y-5 text-[var(--text-primary)]">
        {/* Encabezado */}
        <div className="space-y-2">
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
          <h2 className="text-base font-medium leading-snug">{tituloContrato(c)}</h2>
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

        {/* Resumen */}
        {c.descripcion && (
          <Seccion titulo="Resumen del requerimiento">
            <div className="max-h-56 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)]/50 p-3 text-sm leading-relaxed text-[var(--text-primary)]">
              {c.descripcion}
            </div>
          </Seccion>
        )}

        {/* Cronograma */}
        <Seccion titulo="Cronograma de etapas">
          {!conDetalle ? (
            <p className="text-sm text-[var(--text-secondary)]">Detalle aún no cargado para este contrato.</p>
          ) : etapas.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">Sin cronograma de etapas registrado.</p>
          ) : (
            <TablaEtapas etapas={etapas} />
          )}
        </Seccion>

        {/* Ítems */}
        <Seccion titulo={`Ítems (${items.length})`}>
          {!conDetalle ? (
            <p className="text-sm text-[var(--text-secondary)]">Detalle aún no cargado para este contrato.</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">Sin ítems registrados.</p>
          ) : (
            <TablaItems items={items} />
          )}
        </Seccion>

        {/* Acción: visibilidad */}
        <div className="border-t border-[var(--border)] pt-4">
          <RadioOculto oculto={oculto} onChange={onToggleOculto} />
        </div>
      </div>
    </Modal>
  )
}

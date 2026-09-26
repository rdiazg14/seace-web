import {
  estadoActualizacion,
  estadoIngesta,
} from '../lib/format'
import {
  LINEA_CHIPS,
  NIVELES,
} from '../features/rutadia/model'
import { useRutaDia, TAM_PAGINA_OPCIONES } from '../features/rutadia/useRutaDia'
import Kpi from '../features/rutadia/components/Kpi'
import Paginador from '../features/rutadia/components/Paginador'
import { Chip, EmptyState, ErrorBox, Skeleton } from '../components/ui'
import OportunidadCard from '../components/OportunidadCard'
import ContratoDetallePanel from '../components/ContratoDetallePanel'

export default function RutaDia() {
  const {
    loading,
    error,
    nivel,
    setNivel,
    linea,
    setLinea,
    cierre,
    setCierre,
    estadoOtras,
    setEstadoOtras,
    tamPagina,
    setTamPagina,
    ocultos,
    mostrarOcultos,
    setMostrarOcultos,
    filtrosAbiertos,
    setFiltrosAbiertos,
    filtrosActivos,
    actualizado,
    ingesta,
    detalleOportunidad,
    setDetalleId,
    postulablesVisibles,
    ocultosList,
    otras,
    pagPost,
    setPaginaPost,
    totalPagPost,
    postPaginados,
    pagOtras,
    setPaginaOtras,
    totalPagOtras,
    otrasPaginados,
    kpis,
    resetPaginas,
    ocultar,
    restaurar,
  } = useRutaDia()

  const headerAct = estadoActualizacion(actualizado)
  const headerIng = estadoIngesta(ingesta)
  const toneCls = (tone: string) =>
    tone === 'stale'
      ? 'text-xs text-red-600 dark:text-red-400'
      : tone === 'warn'
        ? 'text-xs text-amber-600 dark:text-amber-400'
        : 'text-xs text-slate-400'

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-3 py-5 sm:px-4 text-[var(--text-primary)]">
      <header>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-xl text-[var(--text-primary)] sm:text-2xl">Diario</h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Oportunidades ENERTRONIC · score con análisis cuando hay TDR
            </p>
          </div>
          <div className="space-y-0.5 text-right">
            <p className={toneCls(headerIng.tone)}>{headerIng.texto}</p>
            <p className={toneCls(headerAct.tone)}>{headerAct.texto}</p>
          </div>
        </div>
      </header>

      {error && <ErrorBox retry={() => window.location.reload()}>{error}</ErrorBox>}

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Kpi label="Nuevos hoy" value={kpis.nuevosHoy} hint="postulables publicados hoy" />
          <Kpi label="Cierran hoy" value={kpis.cierranHoy} hint="hasta medianoche Lima" warn={kpis.cierranHoy > 0} />
          <Kpi label="Cierran mañana" value={kpis.cierranManana} hint="vigentes" warn={kpis.cierranManana > 0} />
          <Kpi label="Cierran esta semana" value={kpis.cierranSemana} hint="días 2–7" />
          <Kpi label="Consultas abiertas" value={kpis.consultasAbiertas} hint="ventana para enviar consultas" warn={kpis.consultasAbiertas > 0} />
          <Kpi
            label="Vigentes núcleo"
            value={kpis.nucleo}
            hint={`IA ${kpis.nucleoIa} · Cloud ${kpis.nucleoCloud} · Dev ${kpis.nucleoDev}${kpis.nucleoTel ? ` · Tel ${kpis.nucleoTel}` : ''}`}
          />
        </div>
      )}

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-medium text-slate-800 dark:text-slate-200">Postulables</h2>
          <p className="text-[11px] text-slate-500">
            Todos los postulables, ordenados por vencimiento (lo que cierra antes va primero).{' '}
            {postulablesVisibles.length.toLocaleString('es-PE')} en vista.
          </p>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setFiltrosAbiertos(v => !v)}
            aria-expanded={filtrosAbiertos}
            className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            <span className="flex items-center gap-1.5">
              Filtros
              {filtrosActivos > 0 && (
                <span className="rounded-full bg-teal-500 px-1.5 py-0.5 text-[10px] font-medium leading-none text-white">
                  {filtrosActivos}
                </span>
              )}
            </span>
            <span aria-hidden className="text-slate-400">{filtrosAbiertos ? '▴' : '▾'}</span>
          </button>

          {filtrosAbiertos && (
            <div className="space-y-2">
              <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1">
                <Chip active={nivel === null} onClick={() => { setNivel(null); resetPaginas() }}>Todos los niveles</Chip>
                {NIVELES.map(n => (
                  <Chip
                    key={n.id}
                    active={nivel === n.id}
                    tone={n.id === 'nucleo' ? 'ok' : n.id === 'marginal' ? 'muted' : 'accent'}
                    onClick={() => { setNivel(x => x === n.id ? null : n.id); resetPaginas() }}
                  >
                    {n.stars} {n.label}
                  </Chip>
                ))}
              </div>
              <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1">
                <Chip active={linea === null} onClick={() => { setLinea(null); resetPaginas() }}>Todas las líneas</Chip>
                {LINEA_CHIPS.map(c => (
                  <Chip
                    key={c.id}
                    active={linea === c.id}
                    onClick={() => { setLinea(x => x === c.id ? null : c.id); resetPaginas() }}
                  >
                    {c.label}
                  </Chip>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {([
                  ['todos', 'Cierre: todos'],
                  ['hoy', 'Cierran hoy'],
                  ['semana', 'Esta semana'],
                  ['mes', 'Este mes'],
                ] as const).map(([id, label]) => (
                  <Chip key={id} active={cierre === id} onClick={() => { setCierre(id); resetPaginas() }} tone={id === 'hoy' ? 'warn' : 'neutral'}>
                    {label}
                  </Chip>
                ))}
                <span className="ml-1 inline-flex items-center gap-1.5 border-l border-slate-200 pl-2 dark:border-slate-700">
                  <span className="text-[11px] text-slate-500">Por página</span>
                  <select
                    value={tamPagina}
                    onChange={e => { setTamPagina(Number(e.target.value)); resetPaginas() }}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                  >
                    {TAM_PAGINA_OPCIONES.map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </span>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <Skeleton className="h-40" />
        ) : postPaginados.length === 0 ? (
          <EmptyState title="Sin postulables con esos filtros" hint="Los filtros navegan; no borran el resto." />
        ) : (
          <div className="space-y-2">
            {postPaginados.map((o, i) => (
              <OportunidadCard
                key={o.contrato.id}
                o={o}
                rank={(pagPost - 1) * tamPagina + i + 1}
                compact={tamPagina > 50}
                onOpenDetalle={() => setDetalleId(o.contrato.id)}
              />
            ))}
            <Paginador
              pagina={pagPost}
              total={totalPagPost}
              count={postulablesVisibles.length}
              onChange={setPaginaPost}
            />
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-medium text-slate-800 dark:text-slate-200">Otras etapas</h2>
          <p className="text-[11px] text-slate-500">
            Por abrir, en evaluación o vencidos. No son postulables.{' '}
            {otras.length.toLocaleString('es-PE')} en vista.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Chip active={estadoOtras === 'cerrados'} tone="warn" onClick={() => { setEstadoOtras('cerrados'); resetPaginas() }}>
            En evaluación / cerrados
          </Chip>
          <Chip active={estadoOtras === 'por_abrir'} tone="accent" onClick={() => { setEstadoOtras('por_abrir'); resetPaginas() }}>
            Por abrir
          </Chip>
        </div>

        {loading ? (
          <Skeleton className="h-40" />
        ) : otrasPaginados.length === 0 ? (
          <EmptyState title="Nada en otras etapas" hint="No hay contratos por abrir, en evaluación ni vencidos." />
        ) : (
          <div className="space-y-2">
            {otrasPaginados.map((o, i) => (
              <OportunidadCard
                key={o.contrato.id}
                o={o}
                rank={(pagOtras - 1) * tamPagina + i + 1}
                compact={tamPagina > 50}
                onOpenDetalle={() => setDetalleId(o.contrato.id)}
              />
            ))}
            <Paginador
              pagina={pagOtras}
              total={totalPagOtras}
              count={otras.length}
              onChange={setPaginaOtras}
            />
          </div>
        )}
      </section>

      {ocultosList.length > 0 && (
        <section className="space-y-3">
          <button
            type="button"
            onClick={() => setMostrarOcultos(v => !v)}
            className="text-sm font-medium text-slate-600 hover:text-teal-600 dark:text-slate-300"
          >
            {mostrarOcultos ? '▾' : '▸'} Ocultos ({ocultosList.length})
          </button>
          {mostrarOcultos && (
            <div className="space-y-2">
              {ocultosList.map((o, i) => (
                <OportunidadCard
                  key={o.contrato.id}
                  o={o}
                  rank={i + 1}
                  oculto
                  onRestore={() => void restaurar(o.contrato.id)}
                  onOpenDetalle={() => setDetalleId(o.contrato.id)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      <p className="pb-6 text-[11px] text-slate-400">
        Con análisis: rubro 28 + califica 18 + margen% 18 + modalidad/pago 8+8 + plazo/riesgo 5+5 + vigencia/urgencia 10+10;
        si no califica técnicamente → techo 35 (sigue en lista). Sin análisis: heurística rubro 50 + vigencia 25 + urgencia 15 + señales 10.
      </p>

      {detalleOportunidad && (
        <ContratoDetallePanel
          contrato={detalleOportunidad.contrato}
          oculto={ocultos.has(detalleOportunidad.contrato.id)}
          onToggleOculto={(ocultoNuevo) => {
            const id = detalleOportunidad.contrato.id
            if (ocultoNuevo) void ocultar(id)
            else void restaurar(id)
          }}
          onClose={() => setDetalleId(null)}
        />
      )}
    </div>
  )
}

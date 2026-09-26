import { fmtFecha, fmtFechaLarga } from '../lib/format'
import { ErrorBox, Skeleton } from '../components/ui'
import { useDashboard } from '../features/dashboard/useDashboard'
import {
  BriefDiario,
  ConversionBlock,
  Kpi,
  UrgCard,
} from '../features/dashboard/components/DashboardBlocks'
import { TabOportunidades } from '../features/dashboard/components/TabOportunidades'
import { TabResumen } from '../features/dashboard/components/TabResumen'
import { TabTendencias } from '../features/dashboard/components/TabTendencias'
import { InteligenciaNegocio } from '../features/dashboard/components/InteligenciaNegocio'
import { ActividadReciente } from '../features/dashboard/components/ActividadReciente'

export default function Dashboard() {
  const {
    axis,
    grid,
    tip,
    narrow,
    tab,
    setTab,
    catChip,
    setCatChip,
    urg,
    setUrg,
    vista,
    setVista,
    loading,
    error,
    kpis,
    negocio,
    postulables,
    urgentes,
    catBars,
    tendenciaAltas,
    conversion,
    chartRubro,
    chartLinea,
    porMes,
    porObjeto,
    topEntidades,
    porTipoEnt,
    topCats,
    seriesIT,
    cmpMes,
    listaOpp,
    recientes,
    ultima,
  } = useDashboard()

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-3 py-5 sm:px-4">
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      </div>
    )
  }

  if (error || !kpis || !negocio) {
    return <div className="mx-auto max-w-6xl px-3 py-8"><ErrorBox>{error || 'Sin datos de la capa semántica'}</ErrorBox></div>
  }

  const sinUrg = urgentes.hoy.length + urgentes.manana.length + urgentes.semana.length === 0

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-3 py-5 sm:px-4">
      <header>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-xl text-slate-900 sm:text-2xl dark:text-slate-50">Monitor SEACE</h1>
            <p className="text-sm text-slate-500">
              Tablero de negocio ENERTRONIC · postulable = Vigente con ventana abierta ahora
            </p>
          </div>
          <p className="text-xs capitalize text-slate-400">
            {fmtFechaLarga()}
            {ultima && <> · Datos al {fmtFecha(ultima)}</>}
          </p>
        </div>
      </header>

      <BriefDiario kpis={kpis} negocio={negocio} top={postulables.slice(0, 5)} tendencia={tendenciaAltas} />

      {sinUrg ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          Sin urgencias hoy — no hay postulables que cierren en los próximos 7 días.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <UrgCard tone="hoy" title="Cierran hoy" items={urgentes.hoy} />
          <UrgCard tone="manana" title="Cierran mañana" items={urgentes.manana} />
          <UrgCard tone="semana" title="Esta semana" items={urgentes.semana} hint="días 2–7" />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Nuevos hoy" value={kpis.nuevos_hoy_postulables.toLocaleString('es-PE')} hint="postulables publicados hoy" />
        <Kpi label="Postulables" value={kpis.total_postulables.toLocaleString('es-PE')} hint="Vigente + ventana abierta" />
        <Kpi
          label="Núcleo postulables"
          value={negocio.nucleo_postulables.toLocaleString('es-PE')}
          hint={`IA ${negocio.nucleo_ia} · Cloud ${negocio.nucleo_cloud} · Dev ${negocio.nucleo_dev}${negocio.nucleo_tel ? ` · Tel ${negocio.nucleo_tel}` : ''}`}
        />
        <Kpi
          label="Altas IT 7 días"
          value={`${tendenciaAltas > 0 ? '+' : ''}${tendenciaAltas}%`}
          hint={`${kpis.altas_it_7d} vs ${kpis.altas_it_7d_prev} (7 d previos, día Lima)`}
          up={tendenciaAltas >= 0}
        />
        <div className="col-span-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 lg:col-span-1">
          <p className="text-[11px] text-slate-500">Postulables por línea</p>
          <div className="mt-2 space-y-1.5">
            {catBars.slice(0, 5).map((c) => {
              const max = catBars[0]?.total || 1
              return (
                <div key={c.id} className="flex items-center gap-2 text-[11px]">
                  <span className="w-16 shrink-0 truncate text-slate-500">{c.label}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
                    <div className="h-full rounded bg-teal-500" style={{ width: `${(c.total / max) * 100}%` }} />
                  </div>
                  <span className="w-6 text-right text-slate-400">{c.total}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <p className="text-[11px] text-slate-400">
        En evaluación {kpis.en_evaluacion.toLocaleString('es-PE')} · Vigentes con ventana vencida {kpis.vigentes_ventana_vencida.toLocaleString('es-PE')}
        {' '}(fuera del default; chip explícito abajo).
      </p>

      <ConversionBlock data={conversion} />

      <InteligenciaNegocio
        chartRubro={chartRubro}
        chartLinea={chartLinea}
        axis={axis}
        grid={grid}
        tip={tip}
        narrow={narrow}
      />

      <div>
        <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
          {([
            ['oportunidades', 'Oportunidades postulables'],
            ['resumen', 'Resumen general'],
            ['tendencias', 'Tendencias IT'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`relative px-3 py-2 text-xs font-medium sm:text-sm ${
                tab === id ? 'text-teal-600 dark:text-teal-400' : 'text-slate-500'
              }`}
            >
              {label}
              {tab === id && <span className="absolute inset-x-2 -bottom-px h-0.5 bg-teal-500" />}
            </button>
          ))}
        </div>

        {tab === 'oportunidades' && (
          <TabOportunidades
            vista={vista}
            setVista={setVista}
            catChip={catChip}
            setCatChip={setCatChip}
            urg={urg}
            setUrg={setUrg}
            listaOpp={listaOpp}
          />
        )}

        {tab === 'resumen' && (
          <TabResumen
            porMes={porMes}
            porObjeto={porObjeto}
            topEntidades={topEntidades}
            porTipoEnt={porTipoEnt}
            axis={axis}
            grid={grid}
            tip={tip}
            narrow={narrow}
          />
        )}

        {tab === 'tendencias' && (
          <TabTendencias
            seriesIT={seriesIT}
            topCats={topCats}
            cmpMes={cmpMes}
            axis={axis}
            grid={grid}
            tip={tip}
          />
        )}
      </div>

      <ActividadReciente recientes={recientes} />
    </div>
  )
}

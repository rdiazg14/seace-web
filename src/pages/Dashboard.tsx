import { Link } from 'react-router-dom'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import {
  cierraEn, fmtFecha, fmtFechaLarga, haceCuanto,
  nroContrato, seaceUrl, tituloContrato,
} from '../lib/format'
import { IT_CHIPS, labelCat } from '../lib/cats'
import { EmptyState, ErrorBox, Skeleton } from '../components/ui'
import { CierraPill, EstadoPill, ItPill, ObjetoPill } from '../components/Pills'
import { nivelLabel } from '../lib/rutaDia'
import { useDashboard, PIE_COLORS, LINE_COLORS, RUBRO_COLORS } from '../lib/dashboard'
import {
  BriefDiario,
  ConversionBlock,
  ChartCard,
  Kpi,
  Spark,
  UrgCard,
} from '../components/DashboardBlocks'

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

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-slate-800 dark:text-slate-200">Inteligencia de negocio</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard title="Postulables por rubro">
            {chartRubro.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">Sin postulables</p>
            ) : (
              <ResponsiveContainer width="100%" height={narrow ? 220 : 240}>
                <PieChart>
                  <Pie
                    data={chartRubro}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={narrow ? 40 : 50}
                    outerRadius={narrow ? 70 : 85}
                    label={narrow ? false : (props: { name?: string; percent?: number }) =>
                      `${props.name ?? ''} ${Math.round((props.percent ?? 0) * 100)}%`}
                  >
                    {chartRubro.map((r) => (
                      <Cell key={r.rubro} fill={RUBRO_COLORS[r.rubro] || '#94a3b8'} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip contentStyle={tip} formatter={(v, n) => [Number(v ?? 0).toLocaleString('es-PE'), String(n)]} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
          <ChartCard title="Postulables por línea">
            {chartLinea.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">Sin postulables</p>
            ) : (
              <ResponsiveContainer width="100%" height={narrow ? 220 : 240}>
                <BarChart data={chartLinea} barSize={narrow ? 14 : 22}>
                  <CartesianGrid stroke={grid} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: axis, fontSize: narrow ? 9 : 10 }} interval={narrow ? 1 : 0} />
                  <YAxis tick={{ fill: axis, fontSize: 11 }} width={narrow ? 22 : 28} allowDecimals={false} />
                  <Tooltip contentStyle={tip} />
                  <Bar dataKey="value" fill="#14B8A6" radius={[4, 4, 0, 0]} name="Postulables" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      </section>

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
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setVista('postulable')}
                className={`rounded-full px-3 py-1 text-xs ${vista === 'postulable' ? 'bg-teal-500 text-white' : 'border border-slate-300 dark:border-slate-600'}`}
              >
                Postulables
              </button>
              <button
                type="button"
                onClick={() => setVista('cerrados')}
                className={`rounded-full px-3 py-1 text-xs ${vista === 'cerrados' ? 'bg-slate-600 text-white' : 'border border-slate-300 dark:border-slate-600'}`}
              >
                En evaluación / vencidos
              </button>
            </div>
            <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1">
              <button
                type="button"
                onClick={() => setCatChip(null)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs ${!catChip ? 'bg-teal-500 text-white' : 'border border-slate-300 dark:border-slate-600'}`}
              >
                Todas
              </button>
              {IT_CHIPS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCatChip((x) => x === c.id ? null : c.id)}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs ${catChip === c.id ? 'bg-violet-500 text-white' : 'border border-slate-300 dark:border-slate-600'}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            {vista === 'postulable' && (
              <div className="flex gap-1.5">
                {([
                  ['todos', 'Todos'],
                  ['hoy', 'Hoy / mañana'],
                  ['semana', 'Esta semana'],
                  ['mes', 'Este mes'],
                ] as const).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setUrg(id)}
                    className={`rounded-full px-3 py-1 text-xs ${urg === id ? 'bg-teal-500 text-white' : 'border border-slate-300 dark:border-slate-600'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            {listaOpp.length === 0 ? (
              <EmptyState title="Sin oportunidades con esos filtros" hint="Prueba otra categoría, rango o el chip de cerrados." />
            ) : (
              <div className="space-y-2">
                {listaOpp.slice(0, 40).map((c) => {
                  const u = cierraEn(c.fecha_fin_cotizacion)
                  const cerrado = !c.es_postulable
                  return (
                    <div key={c.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-medium">{tituloContrato(c)}</p>
                        <p className="text-xs text-slate-500">{c.entidad}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {c.categoria_it && <ItPill cat={c.categoria_it} />}
                          {c.rubro && (
                            <span className="rounded-full bg-slate-500/15 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                              {nivelLabel(c.rubro)}
                            </span>
                          )}
                          <ObjetoPill objeto={c.objeto} />
                          {cerrado ? (
                            <span className="rounded-full bg-slate-500/20 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                              {c.es_en_evaluacion ? 'En evaluación' : 'Cerrado'}
                            </span>
                          ) : (
                            <CierraPill label={u.label} tone={u.tone} />
                          )}
                        </div>
                      </div>
                      <a href={seaceUrl(c.id)} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-medium text-teal-600 dark:text-teal-400">
                        Ver en SEACE
                      </a>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'resumen' && (
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard title="Contratos publicados por mes (todos los estados, mes UTC)">
              <ResponsiveContainer width="100%" height={narrow ? 220 : 260}>
                <BarChart data={porMes} barSize={narrow ? 12 : 22}>
                  <CartesianGrid stroke={grid} vertical={false} />
                  <XAxis dataKey="mes" tick={{ fill: axis, fontSize: 11 }} />
                  <YAxis tick={{ fill: axis, fontSize: 11 }} width={36} />
                  <Tooltip contentStyle={tip} formatter={(v) => [Number(v ?? 0).toLocaleString('es-PE'), 'Contratos']} />
                  <Bar dataKey="total" fill="#14B8A6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Distribución por objeto (histórico completo)">
              <ResponsiveContainer width="100%" height={narrow ? 240 : 260}>
                <PieChart>
                  <Pie
                    data={porObjeto}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={narrow ? 40 : 55}
                    outerRadius={narrow ? 70 : 90}
                    label={narrow ? false : (props: { name?: string; percent?: number }) => `${props.name ?? ''} ${Math.round((props.percent ?? 0) * 100)}%`}
                  >
                    {porObjeto.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Legend />
                  <Tooltip contentStyle={tip} formatter={(v, n) => [Number(v ?? 0).toLocaleString('es-PE'), String(n)]} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Top 10 entidades (postulables)">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={topEntidades} layout="vertical" margin={{ left: 8, right: 8 }}>
                  <CartesianGrid stroke={grid} horizontal={false} />
                  <XAxis type="number" tick={{ fill: axis, fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={narrow ? 80 : 140} tick={{ fill: axis, fontSize: 10 }} />
                  <Tooltip contentStyle={tip} />
                  <Bar dataKey="total" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Tipo de entidad (postulables)">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={porTipoEnt} barSize={narrow ? 20 : 28}>
                  <CartesianGrid stroke={grid} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: axis, fontSize: narrow ? 9 : 10 }} interval={narrow ? 1 : 0} />
                  <YAxis tick={{ fill: axis, fontSize: 11 }} width={narrow ? 24 : 32} />
                  <Tooltip contentStyle={tip} />
                  <Bar dataKey="total" fill="#14B8A6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        )}

        {tab === 'tendencias' && (
          <div className="mt-4 space-y-4">
            <p className="text-[11px] text-slate-400">
              Serie histórica de publicaciones (todos los estados, mes UTC de fecha_publica). No es el pipeline postulable.
            </p>
            <ChartCard title="Evolución mensual — top 5 categorías IT">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={seriesIT}>
                  <CartesianGrid stroke={grid} />
                  <XAxis dataKey="mes" tick={{ fill: axis, fontSize: 11 }} />
                  <YAxis tick={{ fill: axis, fontSize: 11 }} width={36} />
                  <Tooltip contentStyle={tip} />
                  <Legend />
                  {topCats.map((cat, i) => (
                    <Line key={cat} type="monotone" dataKey={cat} name={labelCat(cat)} stroke={LINE_COLORS[i]} dot={false} strokeWidth={2} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full min-w-[520px] text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900">
                  <tr>
                    <th className="px-3 py-2 font-medium">Categoría</th>
                    <th className="px-3 py-2 font-medium">Mes actual</th>
                    <th className="px-3 py-2 font-medium">vs anterior</th>
                    <th className="px-3 py-2 font-medium">Sparkline</th>
                  </tr>
                </thead>
                <tbody>
                  {cmpMes.map((c) => (
                    <tr key={c.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-3 py-2 font-medium">{c.label}</td>
                      <td className="px-3 py-2">{c.cur.toLocaleString('es-PE')}</td>
                      <td className={`px-3 py-2 ${c.pct >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {c.pct > 0 ? '+' : ''}{c.pct}%
                      </td>
                      <td className="px-3 py-2">
                        <Spark values={c.spark} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <section>
        <h2 className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-200">Actividad reciente</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {recientes.map((c) => (
            <Link key={c.id} to={`/buscar?q=${encodeURIComponent(nroContrato(c))}`} className="rounded-xl border border-slate-200 bg-white p-3 transition hover:border-teal-400 dark:border-slate-800 dark:bg-slate-900">
              <p className="line-clamp-2 text-sm font-medium">{tituloContrato(c)}</p>
              <p className="text-xs text-slate-500">{c.entidad}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <ObjetoPill objeto={c.objeto} />
                <EstadoPill estado={c.estado} />
                <span className="text-[11px] text-slate-400">{haceCuanto(c.fecha_publica)}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}

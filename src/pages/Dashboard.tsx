import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { supabase } from '../lib/supabase'
import type { Contrato, DashboardResumen } from '../types'
import {
  addCalendarDays, cierraEn, dayOf, fmtFecha, fmtFechaLarga, haceCuanto,
  limaDateISO, nroContrato, seaceUrl, tituloContrato,
} from '../lib/format'
import { IT_CHIPS, labelCat, tipoEntidad } from '../lib/cats'
import { useTheme } from '../lib/theme'
import { EmptyState, ErrorBox, Skeleton } from '../components/ui'
import { CierraPill, EstadoPill, ItPill, ObjetoPill } from '../components/Pills'

type Tab = 'oportunidades' | 'resumen' | 'tendencias'
type UrgFilter = 'todos' | 'hoy' | 'semana' | 'mes'

const PIE_COLORS = ['#14B8A6', '#6366f1', '#f59e0b', '#ef4444']
const LINE_COLORS = ['#14B8A6', '#8b5cf6', '#f59e0b', '#3b82f6', '#ef4444']
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export default function Dashboard() {
  const { theme } = useTheme()
  const axis = theme === 'dark' ? '#94a3b8' : '#64748b'
  const grid = theme === 'dark' ? '#1e293b' : '#e2e8f0'
  const tipBg = theme === 'dark' ? '#0f172a' : '#fff'
  const tipFg = theme === 'dark' ? '#e2e8f0' : '#0f172a'

  const [tab, setTab] = useState<Tab>('oportunidades')
  const [resumen, setResumen] = useState<DashboardResumen[]>([])
  const [itVig, setItVig] = useState<Contrato[]>([])
  const [recientes, setRecientes] = useState<Contrato[]>([])
  const [nuevosHoy, setNuevosHoy] = useState(0)
  const [itSemana, setItSemana] = useState(0)
  const [itSemanaAnt, setItSemanaAnt] = useState(0)
  const [ultima, setUltima] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [catChip, setCatChip] = useState<string | null>(null)
  const [urg, setUrg] = useState<UrgFilter>('todos')
  const [narrow, setNarrow] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const apply = () => setNarrow(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      const now = new Date()
      const iso24h = new Date(now.getTime() - 86400000).toISOString()
      const iso7 = new Date(now.getTime() - 7 * 86400000).toISOString()
      const iso14 = new Date(now.getTime() - 14 * 86400000).toISOString()
      try {
        const [r1, r2, r3, r4, r5, r6, r7] = await Promise.all([
          supabase.from('dashboard_resumen').select('*'),
          supabase.from('contratos').select('*')
            .eq('estado', 'Vigente').not('categoria_it', 'is', null)
            .order('fecha_fin_cotizacion', { ascending: true, nullsFirst: false })
            .limit(800),
          supabase.from('contratos').select('*')
            .order('fecha_publica', { ascending: false }).limit(10),
          supabase.from('contratos').select('id', { count: 'exact', head: true })
            .gte('fecha_publica', iso24h),
          supabase.from('contratos').select('id', { count: 'exact', head: true })
            .not('categoria_it', 'is', null).gte('fecha_publica', iso7),
          supabase.from('contratos').select('id', { count: 'exact', head: true })
            .not('categoria_it', 'is', null).gte('fecha_publica', iso14).lt('fecha_publica', iso7),
          supabase.from('contratos').select('fecha_publica')
            .order('fecha_publica', { ascending: false }).limit(1),
        ])
        if (cancelled) return
        if (r1.error || r2.error) throw new Error(r1.error?.message || r2.error?.message)
        setResumen((r1.data ?? []) as DashboardResumen[])
        setItVig((r2.data ?? []) as Contrato[])
        setRecientes((r3.data ?? []) as Contrato[])
        setNuevosHoy(r4.count ?? 0)
        setItSemana(r5.count ?? 0)
        setItSemanaAnt(r6.count ?? 0)
        setUltima(r7.data?.[0]?.fecha_publica ?? null)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudo cargar el dashboard')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const today = limaDateISO()
  const tomorrow = addCalendarDays(today, 1)
  const weekEnd = addCalendarDays(today, 7)

  const urgentes = useMemo(() => {
    const hoy: Contrato[] = []
    const manana: Contrato[] = []
    const semana: Contrato[] = []
    for (const c of itVig) {
      const d = dayOf(c.fecha_fin_cotizacion)
      if (!d) continue
      if (d === today) hoy.push(c)
      else if (d === tomorrow) manana.push(c)
      else if (d <= weekEnd) semana.push(c)
    }
    return { hoy, manana, semana }
  }, [itVig, today, tomorrow, weekEnd])

  const catBars = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of resumen) {
      if (r.estado !== 'Vigente' || !r.categoria_it) continue
      map.set(r.categoria_it, (map.get(r.categoria_it) ?? 0) + r.total)
    }
    return [...map.entries()]
      .map(([id, total]) => ({ id, label: labelCat(id), total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6)
  }, [resumen])

  const vigentesItCount = useMemo(
    () => resumen.filter(r => r.estado === 'Vigente' && r.categoria_it).reduce((s, r) => s + r.total, 0),
    [resumen],
  )

  const tendenciaPct = itSemanaAnt === 0
    ? (itSemana > 0 ? 100 : 0)
    : Math.round(((itSemana - itSemanaAnt) / itSemanaAnt) * 100)

  const porMes = useMemo(() => {
    const map = new Array(12).fill(0)
    for (const r of resumen) {
      const m = new Date(r.mes).getUTCMonth()
      if (!Number.isNaN(m)) map[m] += r.total
    }
    return map.map((total, i) => ({ mes: MESES[i], total }))
  }, [resumen])

  const porObjeto = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of resumen) map.set(r.objeto || '—', (map.get(r.objeto || '—') ?? 0) + r.total)
    const arr = [...map.entries()].map(([name, value]) => ({ name, value }))
    const sum = arr.reduce((s, x) => s + x.value, 0) || 1
    return arr.map(x => ({ ...x, pct: Math.round((x.value / sum) * 100) }))
  }, [resumen])

  const topEntidades = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of itVig) map.set(c.entidad, (map.get(c.entidad) ?? 0) + 1)
    return [...map.entries()].map(([name, total]) => ({ name: name.slice(0, 42), total }))
      .sort((a, b) => b.total - a.total).slice(0, 10)
  }, [itVig])

  const porTipoEnt = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of itVig) {
      const t = tipoEntidad(c.entidad)
      map.set(t, (map.get(t) ?? 0) + 1)
    }
    return [...map.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total)
  }, [itVig])

  const topCats = useMemo(() => catBars.slice(0, 5).map(c => c.id), [catBars])

  const seriesIT = useMemo(() => {
    const months = porMes.map(m => m.mes)
    const rows = months.map(mes => {
      const row: Record<string, string | number> = { mes }
      for (const cat of topCats) row[cat] = 0
      return row
    })
    for (const r of resumen) {
      if (!r.categoria_it || !topCats.includes(r.categoria_it)) continue
      const m = new Date(r.mes).getUTCMonth()
      if (!Number.isNaN(m)) rows[m][r.categoria_it] = Number(rows[m][r.categoria_it] ?? 0) + r.total
    }
    return rows
  }, [resumen, porMes, topCats])

  const cmpMes = useMemo(() => {
    const nowM = new Date().getUTCMonth()
    const prev = nowM === 0 ? 11 : nowM - 1
    return catBars.map(c => {
      let cur = 0
      let ant = 0
      for (const r of resumen) {
        if (r.categoria_it !== c.id) continue
        const m = new Date(r.mes).getUTCMonth()
        if (m === nowM) cur += r.total
        if (m === prev) ant += r.total
      }
      const pct = ant === 0 ? (cur > 0 ? 100 : 0) : Math.round(((cur - ant) / ant) * 100)
      const spark = seriesIT.map(row => Number(row[c.id] ?? 0))
      return { ...c, cur, ant, pct, spark }
    })
  }, [catBars, resumen, seriesIT])

  const listaOpp = useMemo(() => {
    return itVig.filter(c => {
      if (catChip && c.categoria_it !== catChip) return false
      const u = cierraEn(c.fecha_fin_cotizacion)
      if (urg === 'hoy') return u.tone === 'hoy' || u.tone === 'vencido' || u.tone === 'manana'
      if (urg === 'semana') return u.days != null && u.days <= 7
      if (urg === 'mes') return u.days != null && u.days <= 30
      return true
    })
  }, [itVig, catChip, urg])

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-3 py-5 sm:px-4">
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}</div>
      </div>
    )
  }

  if (error) {
    return <div className="mx-auto max-w-6xl px-3 py-8"><ErrorBox>{error}</ErrorBox></div>
  }

  const sinUrg = urgentes.hoy.length + urgentes.manana.length + urgentes.semana.length === 0
  const tip = { background: tipBg, border: `1px solid ${grid}`, color: tipFg, fontSize: 12 }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-3 py-5 sm:px-4">
      <header>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-xl text-slate-900 sm:text-2xl dark:text-slate-50">Monitor SEACE</h1>
            <p className="text-sm text-slate-500">Oportunidades del día para IT/tecnología</p>
          </div>
          <p className="text-xs capitalize text-slate-400">
            {fmtFechaLarga()}
            {ultima && <> · Datos al {fmtFecha(ultima)}</>}
          </p>
        </div>
      </header>

      {sinUrg ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          Sin urgencias hoy — no hay contratos IT que cierren en los próximos 7 días.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <UrgCard tone="hoy" title="Cierran hoy" items={urgentes.hoy} />
          <UrgCard tone="manana" title="Cierran mañana" items={urgentes.manana} />
          <UrgCard tone="semana" title="Esta semana" items={urgentes.semana} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Nuevos hoy" value={nuevosHoy.toLocaleString('es-PE')} hint="publicados 24 h" />
        <Kpi label="Vigentes IT" value={vigentesItCount.toLocaleString('es-PE')} hint="proceso vigente en SEACE" />
        <Kpi
          label="Tendencia IT"
          value={`${tendenciaPct > 0 ? '+' : ''}${tendenciaPct}%`}
          hint="vs semana anterior"
          up={tendenciaPct >= 0}
        />
        <div className="col-span-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 lg:col-span-1">
          <p className="text-[11px] text-slate-500">Por categoría IT vigente</p>
          <div className="mt-2 space-y-1.5">
            {catBars.slice(0, 5).map(c => {
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

      <div>
        <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
          {([
            ['oportunidades', 'Oportunidades IT vigentes'],
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
            <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1">
              <button
                type="button"
                onClick={() => setCatChip(null)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs ${!catChip ? 'bg-teal-500 text-white' : 'border border-slate-300 dark:border-slate-600'}`}
              >
                Todas
              </button>
              {IT_CHIPS.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCatChip(x => x === c.id ? null : c.id)}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs ${catChip === c.id ? 'bg-violet-500 text-white' : 'border border-slate-300 dark:border-slate-600'}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
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
            {listaOpp.length === 0 ? (
              <EmptyState title="Sin oportunidades con esos filtros" hint="Prueba otra categoría o rango de cierre." />
            ) : (
              <div className="space-y-2">
                {listaOpp.slice(0, 40).map(c => {
                  const u = cierraEn(c.fecha_fin_cotizacion)
                  return (
                    <div key={c.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-medium">{tituloContrato(c)}</p>
                        <p className="text-xs text-slate-500">{c.entidad}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {c.categoria_it && <ItPill cat={c.categoria_it} />}
                          <ObjetoPill objeto={c.objeto} />
                          <CierraPill label={u.label} tone={u.tone} />
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
            <ChartCard title="Contratos por mes (2026)">
              <ResponsiveContainer width="100%" height={narrow ? 220 : 260}>
                <BarChart data={porMes} barSize={narrow ? 12 : 22}>
                  <CartesianGrid stroke={grid} vertical={false} />
                  <XAxis dataKey="mes" tick={{ fill: axis, fontSize: 11 }} />
                  <YAxis tick={{ fill: axis, fontSize: 11 }} width={36} />
                  <Tooltip contentStyle={tip} formatter={v => [Number(v ?? 0).toLocaleString('es-PE'), 'Contratos']} />
                  <Bar dataKey="total" fill="#14B8A6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Distribución por objeto">
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
            <ChartCard title="Top 10 entidades (IT vigentes)">
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
            <ChartCard title="Tipo de entidad (IT vigentes)">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={porTipoEnt} barSize={28}>
                  <CartesianGrid stroke={grid} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: axis, fontSize: 10 }} interval={0} />
                  <YAxis tick={{ fill: axis, fontSize: 11 }} width={32} />
                  <Tooltip contentStyle={tip} />
                  <Bar dataKey="total" fill="#14B8A6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        )}

        {tab === 'tendencias' && (
          <div className="mt-4 space-y-4">
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
                  {cmpMes.map(c => (
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
          {recientes.map(c => (
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

function Kpi({ label, value, hint, up }: { label: string; value: string; hint: string; up?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-medium ${up === false ? 'text-red-500' : up === true ? 'text-emerald-500' : ''}`}>{value}</p>
      <p className="text-[11px] text-slate-400">{hint}</p>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <p className="mb-2 text-sm font-medium">{title}</p>
      {children}
    </div>
  )
}

function UrgCard({ tone, title, items }: { tone: 'hoy' | 'manana' | 'semana'; title: string; items: Contrato[] }) {
  const wrap =
    tone === 'hoy'
      ? 'border-red-500/40 bg-red-500/10'
      : tone === 'manana'
        ? 'border-amber-500/40 bg-amber-500/10'
        : 'border-emerald-500/40 bg-emerald-500/10'
  return (
    <div className={`rounded-xl border p-3 ${wrap}`}>
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-lg font-medium">{items.length}</p>
      </div>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500">Ninguno</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {items.slice(0, 3).map(c => (
            <li key={c.id}>
              <a href={seaceUrl(c.id)} target="_blank" rel="noreferrer" className="block">
                <p className="line-clamp-1 text-xs font-medium">{tituloContrato(c)}</p>
                <p className="truncate text-[11px] text-slate-500">{c.entidad}</p>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Spark({ values }: { values: number[] }) {
  const w = 80
  const h = 22
  const max = Math.max(...values, 1)
  const pts = values.map((v, i) => {
    const x = values.length <= 1 ? 0 : (i / (values.length - 1)) * w
    const y = h - (v / max) * (h - 2) - 1
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={w} height={h} className="text-teal-500">
      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={pts} />
    </svg>
  )
}

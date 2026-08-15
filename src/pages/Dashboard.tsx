import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { supabase } from '../lib/supabase'
import type { DashboardResumen, Contrato } from '../types'
import ContratoCard from '../components/ContratoCard'

const PIE_COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6']
const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

type Tab = 'resumen' | 'vigentes' | 'it'

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>('resumen')
  const [resumen, setResumen] = useState<DashboardResumen[]>([])
  const [vigentes, setVigentes] = useState<Contrato[]>([])
  const [itContratos, setItContratos] = useState<Contrato[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [res1, res2, res3] = await Promise.all([
        supabase.from('dashboard_resumen').select('*'),
        supabase.from('vigentes_urgentes').select('*').limit(30),
        supabase.from('contratos')
          .select('*')
          .not('categoria_it', 'is', null)
          .order('fecha_publica', { ascending: false })
          .limit(50),
      ])
      if (res1.data) setResumen(res1.data as DashboardResumen[])
      if (res2.data) setVigentes(res2.data as Contrato[])
      if (res3.data) setItContratos(res3.data as Contrato[])
      setLoading(false)
    }
    load()
  }, [])

  // Aggregate stats
  const total2026 = resumen
    .filter(r => r.mes >= '2026-01-01')
    .reduce((s, r) => s + r.total, 0)
  const totalVigentes = resumen
    .filter(r => r.estado === 'Vigente')
    .reduce((s, r) => s + r.total, 0)
  const totalIt = resumen
    .filter(r => r.categoria_it !== null)
    .reduce((s, r) => s + r.total, 0)
  const totalIa = resumen
    .filter(r => r.categoria_it === 'IA/analytics')
    .reduce((s, r) => s + r.total, 0)

  // Bar chart: contratos por mes 2026
  const byMes: Record<string, number> = {}
  resumen
    .filter(r => r.mes >= '2026-01-01' && r.mes <= '2026-12-31')
    .forEach(r => { byMes[r.mes] = (byMes[r.mes] ?? 0) + r.total })
  const barData = Object.entries(byMes)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, total]) => ({
      mes: MESES[parseInt(mes.slice(5, 7)) - 1],
      total,
    }))

  // Pie chart: por objeto
  const byObjeto: Record<string, number> = {}
  resumen.forEach(r => { byObjeto[r.objeto] = (byObjeto[r.objeto] ?? 0) + r.total })
  const pieData = Object.entries(byObjeto).map(([name, value]) => ({ name, value }))

  const tabBtn = (id: Tab, label: string) => (
    <button
      onClick={() => setTab(id)}
      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
        tab === id
          ? 'bg-emerald-600 text-white'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">
          Monitor SEACE <span className="text-emerald-400">Perú</span>
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Corpus completo de contrataciones menores — {resumen.reduce((s,r)=>s+r.total,0).toLocaleString('es-PE')} registros
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Contratos 2026', value: total2026.toLocaleString('es-PE'), color: 'text-emerald-400' },
          { label: 'Vigentes', value: totalVigentes.toLocaleString('es-PE'), color: 'text-amber-400' },
          { label: 'Con IT', value: totalIt.toLocaleString('es-PE'), color: 'text-indigo-400' },
          { label: 'IA/analytics', value: totalIa.toLocaleString('es-PE'), color: 'text-red-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <p className="text-slate-400 text-xs mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{loading ? '…' : value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 bg-slate-800/50 p-1.5 rounded-lg w-fit border border-slate-700">
        {tabBtn('resumen', 'Resumen 2026')}
        {tabBtn('vigentes', 'Vigentes hoy')}
        {tabBtn('it', 'IT / Tecnología')}
      </div>

      {/* Tab: Resumen */}
      {tab === 'resumen' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <h2 className="text-slate-200 text-sm font-semibold mb-4">Contratos por mes (2026)</h2>
            {barData.length === 0 ? (
              <p className="text-slate-500 text-sm py-8 text-center">Cargando…</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="mes" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                    labelStyle={{ color: '#cbd5e1' }}
                    itemStyle={{ color: '#10b981' }}
                  />
                  <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <h2 className="text-slate-200 text-sm font-semibold mb-4">Distribución por tipo de objeto</h2>
            {pieData.length === 0 ? (
              <p className="text-slate-500 text-sm py-8 text-center">Cargando…</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    dataKey="value"
                    label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                    itemStyle={{ color: '#cbd5e1' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* Tab: Vigentes */}
      {tab === 'vigentes' && (
        <div className="space-y-3">
          {loading && <p className="text-slate-400 text-sm">Cargando…</p>}
          {!loading && vigentes.length === 0 && (
            <p className="text-slate-400 text-sm">No hay contratos vigentes en este momento.</p>
          )}
          {vigentes.map(c => <ContratoCard key={c.id} c={c} />)}
        </div>
      )}

      {/* Tab: IT/IA */}
      {tab === 'it' && (
        <div className="space-y-3">
          {loading && <p className="text-slate-400 text-sm">Cargando…</p>}
          {!loading && itContratos.length === 0 && (
            <p className="text-slate-400 text-sm">Sin resultados IT.</p>
          )}
          {itContratos.map(c => <ContratoCard key={c.id} c={c} />)}
        </div>
      )}
    </div>
  )
}

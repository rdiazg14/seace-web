import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { useTheme } from '../lib/theme'
import type { ChatGrafica } from '../lib/analisis'

const CHART_VARS = ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5', '--chart-6']

function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

function fmt(n: number, unidad: string): string {
  const num = n.toLocaleString('es-PE', { maximumFractionDigits: 1 })
  return unidad ? `${num} ${unidad}` : num
}

export function ChatChart({ grafica }: { grafica: ChatGrafica }) {
  useTheme()
  const colors = CHART_VARS.map((name, i) => cssVar(name, ['#047857', '#6d28d9', '#1d4ed8', '#b45309', '#b91c1c', '#0e7490'][i]))
  const axis = cssVar('--text-secondary', '#a1a1aa')
  const grid = cssVar('--border', '#3f3f46')
  const tipBg = cssVar('--bg-card', '#18181b')
  const tipFg = cssVar('--text-primary', '#fafafa')
  const tip = {
    background: tipBg,
    border: `1px solid ${grid}`,
    color: tipFg,
    fontSize: 12,
    borderRadius: 8,
  }
  const data = (grafica.datos || [])
    .filter(d => d && typeof d.valor === 'number' && Number.isFinite(d.valor))
    .map(d => ({ name: d.label, valor: d.valor }))
  if (!data.length) return null

  const unidad = grafica.unidad || ''
  const tipo = grafica.tipo_grafica || 'barras'

  return (
    <div className="mt-3">
      {grafica.titulo && (
        <p className="mb-1.5 text-[11px] font-medium text-[var(--text-secondary)]">{grafica.titulo}</p>
      )}
      <div className="h-[200px] w-full min-w-0">
        <ResponsiveContainer width="100%" height={200}>
          {tipo === 'pie' ? (
            <PieChart>
              <Pie data={data} dataKey="valor" nameKey="name" innerRadius={36} outerRadius={64}>
                {data.map((_, i) => (
                  <Cell key={i} fill={colors[i % colors.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={tip}
                labelStyle={{ color: tipFg }}
                itemStyle={{ color: tipFg }}
                formatter={(v) => [fmt(Number(v ?? 0), unidad), unidad || 'valor']}
              />
            </PieChart>
          ) : tipo === 'lineas' ? (
            <LineChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 28 }}>
              <CartesianGrid stroke={grid} vertical={false} />
              <XAxis dataKey="name" tick={{ fill: axis, fontSize: 9 }} interval={0} angle={-35} textAnchor="end" height={48} tickFormatter={v => String(v).slice(0, 12)} />
              <YAxis tick={{ fill: axis, fontSize: 9 }} width={36} />
              <Tooltip contentStyle={tip} labelStyle={{ color: tipFg }} itemStyle={{ color: tipFg }} formatter={(v) => [fmt(Number(v ?? 0), unidad), unidad || 'valor']} />
              <Line type="monotone" dataKey="valor" stroke={colors[0]} strokeWidth={2} dot={{ fill: colors[0] }} />
            </LineChart>
          ) : (
            <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 28 }}>
              <CartesianGrid stroke={grid} vertical={false} />
              <XAxis dataKey="name" tick={{ fill: axis, fontSize: 9 }} interval={0} angle={-35} textAnchor="end" height={48} tickFormatter={v => String(v).slice(0, 12)} />
              <YAxis tick={{ fill: axis, fontSize: 9 }} width={36} />
              <Tooltip contentStyle={tip} labelStyle={{ color: tipFg }} itemStyle={{ color: tipFg }} formatter={(v) => [fmt(Number(v ?? 0), unidad), unidad || 'valor']} />
              <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                {data.map((_, i) => (
                  <Cell key={i} fill={colors[i % colors.length]} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

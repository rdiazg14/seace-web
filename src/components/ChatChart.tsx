import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { useTheme } from '../lib/theme'
import type { ChatGrafica } from '../lib/analisis'

const DARK = ['#34d399', '#a78bfa', '#60a5fa', '#fbbf24', '#f87171', '#22d3ee']
const LIGHT = ['#059669', '#7c3aed', '#2563eb', '#d97706', '#dc2626', '#0891b2']

function fmt(n: number, unidad: string): string {
  const num = n.toLocaleString('es-PE', { maximumFractionDigits: 1 })
  return unidad ? `${num} ${unidad}` : num
}

export function ChatChart({ grafica }: { grafica: ChatGrafica }) {
  const { isDark } = useTheme()
  const colors = isDark ? DARK : LIGHT
  const axis = isDark ? '#a1a1aa' : '#52525b'
  const grid = isDark ? '#3f3f46' : '#e4e4e7'
  const tipBg = isDark ? '#18181b' : '#fff'
  const tipFg = isDark ? '#fafafa' : '#09090b'
  const tip = { background: tipBg, border: `1px solid ${grid}`, color: tipFg, fontSize: 12 }
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
                formatter={(v) => [fmt(Number(v ?? 0), unidad), unidad || 'valor']}
              />
            </PieChart>
          ) : tipo === 'lineas' ? (
            <LineChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 28 }}>
              <CartesianGrid stroke={grid} vertical={false} />
              <XAxis dataKey="name" tick={{ fill: axis, fontSize: 9 }} interval={0} angle={-35} textAnchor="end" height={48} tickFormatter={v => String(v).slice(0, 12)} />
              <YAxis tick={{ fill: axis, fontSize: 9 }} width={36} />
              <Tooltip contentStyle={tip} formatter={(v) => [fmt(Number(v ?? 0), unidad), unidad || 'valor']} />
              <Line type="monotone" dataKey="valor" stroke={colors[0]} strokeWidth={2} dot />
            </LineChart>
          ) : (
            <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 28 }}>
              <CartesianGrid stroke={grid} vertical={false} />
              <XAxis dataKey="name" tick={{ fill: axis, fontSize: 9 }} interval={0} angle={-35} textAnchor="end" height={48} tickFormatter={v => String(v).slice(0, 12)} />
              <YAxis tick={{ fill: axis, fontSize: 9 }} width={36} />
              <Tooltip contentStyle={tip} formatter={(v) => [fmt(Number(v ?? 0), unidad), unidad || 'valor']} />
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

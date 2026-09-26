import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { labelCat } from '../../../lib/cats'
import { ChartCard, Spark } from './DashboardBlocks'
import { LINE_COLORS } from '../useDashboard'

export function TabTendencias({
  seriesIT,
  topCats,
  cmpMes,
  axis,
  grid,
  tip,
}: {
  seriesIT: Record<string, string | number>[]
  topCats: string[]
  cmpMes: { id: string; label: string; cur: number; ant: number; pct: number; spark: number[] }[]
  axis: string
  grid: string
  tip: React.CSSProperties
}) {
  return (
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
  )
}

import {
  Bar, BarChart, CartesianGrid, Cell, Legend,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { ChartCard } from './DashboardBlocks'
import { RUBRO_COLORS } from '../useDashboard'

export function InteligenciaNegocio({
  chartRubro,
  chartLinea,
  axis,
  grid,
  tip,
  narrow,
}: {
  chartRubro: { name: string; value: number; rubro: string }[]
  chartLinea: { name: string; value: number }[]
  axis: string
  grid: string
  tip: React.CSSProperties
  narrow: boolean
}) {
  return (
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
  )
}

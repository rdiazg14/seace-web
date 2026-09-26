import {
  Bar, BarChart, CartesianGrid, Cell, Legend,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { ChartCard } from './DashboardBlocks'
import { PIE_COLORS } from '../useDashboard'

export function TabResumen({
  porMes,
  porObjeto,
  topEntidades,
  porTipoEnt,
  axis,
  grid,
  tip,
  narrow,
}: {
  porMes: { mes: string; total: number }[]
  porObjeto: { name: string; value: number; pct: number }[]
  topEntidades: { name: string; total: number }[]
  porTipoEnt: { name: string; total: number }[]
  axis: string
  grid: string
  tip: React.CSSProperties
  narrow: boolean
}) {
  return (
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
  )
}

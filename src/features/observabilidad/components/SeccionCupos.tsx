import { ErrorBox, Skeleton } from '../../../components/ui'
import type { AdminStats, KvFila } from '../model'

export function SeccionCupos({
  stats,
  statsErr,
  statsLoading,
  loadStats,
  kvRows,
}: {
  stats: AdminStats | null
  statsErr: string | null
  statsLoading: boolean
  loadStats: () => Promise<void>
  kvRows: KvFila[]
}) {
  return (
  <section className="space-y-3">
    <h2 className="text-sm font-medium">Cupos y caché (hoy UTC)</h2>
    <p className="text-sm text-slate-500">
      Contadores diarios del Worker (KV). El detalle de quién gastó, en qué
      proyecto y a qué hora está en la sección de consumo de IA de arriba.
    </p>
    {statsErr && <ErrorBox retry={() => void loadStats()}>{statsErr}</ErrorBox>}
    {statsLoading ? (
      <Skeleton className="h-48 w-full" />
    ) : stats ? (
      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
        <table className="w-full min-w-[28rem] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
            <tr>
              <th className="px-3 py-2 font-medium">Métrica</th>
              <th className="px-3 py-2 font-medium">Clave KV</th>
              <th className="px-3 py-2 font-medium">Hoy</th>
            </tr>
          </thead>
          <tbody>
            {kvRows.map((r) => (
              <tr key={r.clave} className="border-t border-slate-200 dark:border-slate-800">
                <td className="px-3 py-2">{r.label}</td>
                <td className="px-3 py-2 font-mono text-xs text-slate-500">{r.clave}</td>
                <td className="px-3 py-2 tabular-nums">{r.valor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : null}
  </section>
  )
}

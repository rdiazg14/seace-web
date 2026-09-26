import { KEYWORD_CATS } from '../../../lib/cats'
import { EmptyState, Skeleton } from '../../../components/ui'
import { catsSugeridas, type ColaRow } from '../model'

export function ColaRevision({
  cola,
  loading,
  busyId,
  catElegida,
  setCatElegida,
  onAprobarCola,
  onRechazarCola,
}: {
  cola: ColaRow[]
  loading: boolean
  busyId: number | null
  catElegida: Record<number, string>
  setCatElegida: React.Dispatch<React.SetStateAction<Record<number, string>>>
  onAprobarCola: (r: ColaRow) => Promise<void>
  onRechazarCola: (r: ColaRow) => Promise<void>
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium">Cola de revisión</h2>
      <p className="text-xs text-slate-500">
        Discrepancias de Gemini. Aprobar escribe capa=humano. Rechazar deja el
        contrato sin clasificar y entra al ledger. Escritura vía admin-keywords.
      </p>
      {loading ? (
        <Skeleton className="h-32 w-full" />
      ) : cola.length === 0 ? (
        <EmptyState title="Cola vacía" hint="Gemini semanal carga pendientes acá." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
              <tr>
                <th className="px-3 py-2 font-medium">Id</th>
                <th className="px-3 py-2 font-medium">Título</th>
                <th className="px-3 py-2 font-medium">Origen</th>
                <th className="px-3 py-2 font-medium">P1 / P2</th>
                <th className="px-3 py-2 font-medium">Votos</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {cola.map((r) => {
                const sugeridas = catsSugeridas(r)
                const elegida = catElegida[r.id] || sugeridas[0] || KEYWORD_CATS[0]
                const votosTxt = r.votos
                  ? Object.entries(r.votos).map(([, v]) => v).join(' · ')
                  : '—'
                return (
                  <tr key={r.id} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="px-3 py-2 font-mono text-xs">{r.contrato_id}</td>
                    <td className="max-w-[18rem] truncate px-3 py-2 text-xs" title={r.titulo ?? ''}>
                      {r.titulo || '—'}
                    </td>
                    <td className="px-3 py-2 text-xs">{r.origen || '—'}</td>
                    <td className="px-3 py-2 text-xs">
                      {r.categoria_p1 || '—'}
                      {' / '}
                      {r.categoria_p2 || '—'}
                    </td>
                    <td className="max-w-[12rem] truncate px-3 py-2 text-xs" title={votosTxt}>{votosTxt}</td>
                    <td className="px-3 py-2 text-xs">{r.estado}</td>
                    <td className="px-3 py-2">
                      {r.estado === 'observacion' ? (
                        <span className="text-xs text-slate-500" title={r.nota ?? ''}>
                          {r.nota || 'límite conocido'}
                        </span>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={elegida}
                            onChange={(e) => setCatElegida((m) => ({ ...m, [r.id]: e.target.value }))}
                            className="rounded border border-slate-300 bg-white px-1 py-1 text-xs dark:border-slate-700 dark:bg-slate-950"
                          >
                            {(sugeridas.length ? sugeridas : [...KEYWORD_CATS]).map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                            {sugeridas.length > 0 && KEYWORD_CATS.filter((c) => !sugeridas.includes(c)).map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={busyId === r.id}
                            onClick={() => void onAprobarCola(r)}
                            className="text-xs font-medium text-teal-700 hover:underline disabled:opacity-50 dark:text-teal-400"
                          >
                            {busyId === r.id ? '…' : 'Aprobar'}
                          </button>
                          <button
                            type="button"
                            disabled={busyId === r.id}
                            onClick={() => void onRechazarCola(r)}
                            className="text-xs font-medium text-slate-600 hover:underline disabled:opacity-50 dark:text-slate-300"
                          >
                            Rechazar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-500">
        {cola.filter((r) => r.estado === 'pendiente').length} pendientes
        {' · '}
        {cola.filter((r) => r.estado === 'observacion').length} observaciones
      </p>
    </section>
  )
}

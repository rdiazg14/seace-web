import { EmptyState, Skeleton } from '../../../components/ui'
import { senalOriginal, terminoDe, UMBRAL_SIMULACION, type CandidataRow } from '../model'
import type { SimularResultado } from '../api'
import { PanelSimular } from './PanelSimular'

export function TablaCandidatas({
  cands,
  loading,
  busyId,
  simCand,
  onSimularCand,
  onPromover,
}: {
  cands: CandidataRow[]
  loading: boolean
  busyId: number | null
  simCand: { id: number; r: SimularResultado } | null
  onSimularCand: (c: CandidataRow) => Promise<void>
  onPromover: (c: CandidataRow) => Promise<void>
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium">Candidatas</h2>
      {loading ? (
        <Skeleton className="h-32 w-full" />
      ) : cands.length === 0 ? (
        <EmptyState title="Sin candidatas" hint="Las registra Gemini en el semanal." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
              <tr>
                <th className="px-3 py-2 font-medium">Señal original</th>
                <th className="px-3 py-2 font-medium">Término</th>
                <th className="px-3 py-2 font-medium">Categoría</th>
                <th className="px-3 py-2 font-medium">Veces</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {cands.map((c) => (
                <tr key={c.id} className="border-t border-slate-200 dark:border-slate-800">
                  <td className="max-w-[16rem] truncate px-3 py-2 text-xs" title={senalOriginal(c)}>{senalOriginal(c)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{terminoDe(c)}</td>
                  <td className="px-3 py-2">{c.categoria_propuesta}</td>
                  <td className="px-3 py-2 tabular-nums">{c.veces_vista}</td>
                  <td className="px-3 py-2">{c.estado}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      disabled={busyId === c.id}
                      onClick={() => void onSimularCand(c)}
                      className="text-xs font-medium text-teal-700 hover:underline disabled:opacity-50 dark:text-teal-400"
                    >
                      {busyId === c.id ? '…' : 'Simular'}
                    </button>
                    {simCand?.id === c.id && (
                      <button
                        type="button"
                        disabled={busyId === c.id}
                        onClick={() => void onPromover(c)}
                        className="ml-3 text-xs font-medium text-teal-700 hover:underline disabled:opacity-50 dark:text-teal-400"
                      >
                        Promover
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {simCand && (
        <PanelSimular r={simCand.r} umbral={simCand.r.etiquetaria > UMBRAL_SIMULACION} />
      )}
    </section>
  )
}

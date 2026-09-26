/** Estados de la página sin análisis visible: sin TDR, sin análisis, fallo de IA, error y carga. */

import { AlertCircle } from 'lucide-react'
import { ErrorBox, Skeleton } from '../../../components/ui'

export function AnalisisEstados({
  sinTdr,
  sinAnalisis,
  error502,
  error,
  loading,
  onAnalizar,
}: {
  sinTdr: string | null
  sinAnalisis: boolean
  error502: boolean
  error: string | null
  loading: boolean
  onAnalizar: () => void
}) {
  return (
    <>
      {sinTdr && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
          {sinTdr}
        </div>
      )}

      {sinAnalisis && !loading && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-slate-500 dark:text-slate-400" />
            <div>
              <p className="font-medium">Este contrato aún no tiene análisis de IA.</p>
              <p className="mt-1 text-[var(--text-secondary)]">
                El análisis se ejecuta una sola vez, de forma automática, en el pipeline diario para los contratos con TDR disponible. Si este contrato es postulable y ya cuenta con TDR, el análisis debería aparecer en la próxima corrida.
              </p>
              <button
                type="button"
                onClick={onAnalizar}
                className="mt-3 rounded-lg border border-teal-500 px-3 py-1.5 text-sm font-medium text-teal-600 hover:bg-teal-500/10 dark:text-teal-400"
              >
                Analizar ahora
              </button>
            </div>
          </div>
        </div>
      )}

      {error502 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-[var(--text-primary)]">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-medium">El análisis no pudo completarse en este momento.</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                El servicio de IA no respondió correctamente. Suele resolverse en unos segundos.
              </p>
              <button
                type="button"
                onClick={onAnalizar}
                className="mt-3 rounded-lg bg-teal-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-400"
              >
                Reintentar
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <ErrorBox retry={() => window.location.reload()}>{error}</ErrorBox>
      )}

      {loading && !error502 && (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-40" />
        </div>
      )}
    </>
  )
}

import type { AvisoPresupuesto as Aviso } from '../model'

const TONO: Record<Aviso['tono'], string> = {
  neutro: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300',
  ok: 'border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300',
  warn: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  error: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
}

/** Alerta de presupuesto diario de IA (GW-001). El título dice el nivel; el color solo acompaña. */
export function AvisoPresupuesto({ aviso }: { aviso: Aviso | null }) {
  if (!aviso) return null
  const urgente = aviso.tono === 'warn' || aviso.tono === 'error'
  return (
    <div role={urgente ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm ${TONO[aviso.tono]}`}>
      <p className="font-medium">{aviso.titulo}</p>
      <p className="mt-0.5 text-xs">{aviso.detalle}</p>
    </div>
  )
}

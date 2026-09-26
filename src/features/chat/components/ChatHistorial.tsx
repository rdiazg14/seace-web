import type { SesionChat } from '../../../lib/chatSesiones'
import { hace } from '../model'

/** Lista de conversaciones guardadas del chat general. */
export function ChatHistorial({
  sesiones,
  sesionId,
  onAbrir,
  onEliminar,
}: {
  sesiones: SesionChat[]
  sesionId: string | null
  onAbrir: (s: SesionChat) => void
  onEliminar: (s: SesionChat) => void
}) {
  return (
    <div className="max-h-64 overflow-y-auto border-b border-[var(--border)] py-2">
      {sesiones.length === 0 && (
        <p className="px-1 py-2 text-xs text-[var(--text-secondary)]">Todavía no hay conversaciones guardadas.</p>
      )}
      <ul className="space-y-1">
        {sesiones.map(s => (
          <li
            key={s.id}
            className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 ${
              s.id === sesionId ? 'bg-teal-500/10' : 'hover:bg-[var(--bg-card)]'
            }`}
          >
            <button
              type="button"
              onClick={() => onAbrir(s)}
              className="min-w-0 flex-1 text-left"
            >
              <p className="truncate text-sm text-[var(--text-primary)]">{s.titulo}</p>
              <p className="text-[11px] text-[var(--text-secondary)]">
                {s.n_mensajes} msgs · {(s.tokens_prompt + s.tokens_completion).toLocaleString('es-PE')} tokens · {hace(s.updated_at)}
              </p>
            </button>
            <button
              type="button"
              onClick={() => onEliminar(s)}
              className="shrink-0 rounded-md px-1.5 py-0.5 text-xs text-slate-400 hover:bg-red-500/10 hover:text-red-500"
              title="Eliminar"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

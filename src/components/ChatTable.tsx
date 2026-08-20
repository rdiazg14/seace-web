import type { ChatTabla } from '../lib/analisis'

export function ChatTable({ tabla }: { tabla: ChatTabla }) {
  const cols = tabla.columnas || []
  const rows = tabla.filas || []
  if (!cols.length || !rows.length) return null

  return (
    <div className="mt-3">
      {tabla.titulo && (
        <p className="mb-1.5 text-[11px] font-medium text-[var(--text-secondary)]">{tabla.titulo}</p>
      )}
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full min-w-[320px] text-left text-xs">
          <thead className="bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
            <tr>
              {cols.map((c, i) => (
                <th key={i} className="whitespace-nowrap px-3 py-2 font-medium">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-t border-[var(--border)]">
                {cols.map((_, ci) => (
                  <td key={ci} className="px-3 py-2 text-[var(--text-primary)]">{row[ci] ?? ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

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
        <table className="w-full min-w-[260px] text-left text-[11px]">
          <thead className="bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
            <tr>
              {cols.map((c, i) => (
                <th key={i} className="whitespace-nowrap px-2 py-1.5 font-medium">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-t border-[var(--border)]">
                {cols.map((_, ci) => (
                  <td key={ci} className="whitespace-nowrap px-2 py-1.5 text-[var(--text-primary)]">{row[ci] ?? ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

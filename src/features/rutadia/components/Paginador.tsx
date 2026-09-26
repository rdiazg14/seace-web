export default function Paginador({
  pagina,
  total,
  count,
  onChange,
}: {
  pagina: number
  total: number
  count: number
  onChange: (p: number) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      {total > 1 && (
        <button
          type="button"
          disabled={pagina <= 1}
          onClick={() => onChange(pagina - 1)}
          className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-teal-400 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
        >
          ‹ Anterior
        </button>
      )}
      <span className="text-[11px] text-slate-500">
        Página {pagina} de {total} · {count.toLocaleString('es-PE')} resultados
      </span>
      {total > 1 && (
        <button
          type="button"
          disabled={pagina >= total}
          onClick={() => onChange(pagina + 1)}
          className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-teal-400 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
        >
          Siguiente ›
        </button>
      )}
    </div>
  )
}

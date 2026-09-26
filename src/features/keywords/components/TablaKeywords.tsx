import { KEYWORD_CATS } from '../../../lib/cats'
import { Chip, EmptyState, Skeleton } from '../../../components/ui'
import type { FiltroActiva, KeywordRow, SortKey } from '../model'

export function TablaKeywords({
  visibles,
  loading,
  busyId,
  filtroCat,
  setFiltroCat,
  filtroTipo,
  setFiltroTipo,
  filtroActiva,
  setFiltroActiva,
  sort,
  sortAsc,
  clickSort,
  toggleActiva,
}: {
  visibles: KeywordRow[]
  loading: boolean
  busyId: number | null
  filtroCat: string
  setFiltroCat: (v: string) => void
  filtroTipo: string
  setFiltroTipo: (v: string) => void
  filtroActiva: FiltroActiva
  setFiltroActiva: (v: FiltroActiva) => void
  sort: SortKey
  sortAsc: boolean
  clickSort: (k: SortKey) => void
  toggleActiva: (r: KeywordRow) => Promise<void>
}) {
  const th = (k: SortKey, label: string) => (
    <th className="px-3 py-2 font-medium">
      <button type="button" onClick={() => clickSort(k)} className="hover:underline">
        {label}
        {sort === k ? (sortAsc ? ' ↑' : ' ↓') : ''}
      </button>
    </th>
  )

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium">it_keywords</h2>
      <div className="flex flex-wrap gap-2">
        <Chip active={!filtroCat} onClick={() => setFiltroCat('')}>Todas</Chip>
        {KEYWORD_CATS.map((c) => (
          <Chip key={c} active={filtroCat === c} onClick={() => setFiltroCat(c)}>{c}</Chip>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Chip active={!filtroTipo} onClick={() => setFiltroTipo('')}>tipo: todos</Chip>
        <Chip active={filtroTipo === 'incluye'} onClick={() => setFiltroTipo('incluye')}>incluye</Chip>
        <Chip active={filtroTipo === 'excluye'} onClick={() => setFiltroTipo('excluye')}>excluye</Chip>
        <Chip active={filtroActiva === 'todas'} onClick={() => setFiltroActiva('todas')}>activas+inactivas</Chip>
        <Chip active={filtroActiva === 'activas'} onClick={() => setFiltroActiva('activas')}>activas</Chip>
        <Chip active={filtroActiva === 'inactivas'} onClick={() => setFiltroActiva('inactivas')}>inactivas</Chip>
      </div>
      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : visibles.length === 0 ? (
        <EmptyState title="Sin keywords" hint="Probá otro filtro." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
              <tr>
                {th('categoria', 'Categoría')}
                {th('keyword', 'Keyword')}
                <th className="px-3 py-2 font-medium">Tipo</th>
                {th('prioridad', 'Pri')}
                <th className="px-3 py-2 font-medium">Límite</th>
                <th className="px-3 py-2 font-medium">Plural</th>
                <th className="px-3 py-2 font-medium">Activa</th>
                <th className="px-3 py-2 font-medium">Nota</th>
                {th('etiquetas', 'Etiquetas')}
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {visibles.map((r) => (
                <tr key={r.id} className="border-t border-slate-200 dark:border-slate-800">
                  <td className="px-3 py-2">{r.categoria}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.keyword}</td>
                  <td className="px-3 py-2">{r.tipo}</td>
                  <td className="px-3 py-2 tabular-nums">{r.prioridad}</td>
                  <td className="px-3 py-2">{r.limite_palabra ? 'sí' : '—'}</td>
                  <td className="px-3 py-2">{r.tolera_plural ? 'sí' : '—'}</td>
                  <td className="px-3 py-2">{r.activa ? 'sí' : 'no'}</td>
                  <td className="max-w-[12rem] truncate px-3 py-2 text-xs text-slate-500" title={r.nota ?? ''}>{r.nota || '—'}</td>
                  <td className="px-3 py-2 tabular-nums">{r.etiquetas.toLocaleString('es-PE')}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => void toggleActiva(r)}
                      className="text-xs font-medium text-teal-700 hover:underline disabled:opacity-50 dark:text-teal-400"
                    >
                      {busyId === r.id ? '…' : r.activa ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-500">{visibles.length.toLocaleString('es-PE')} filas · no hay borrar · prioridad de categoría se cambia por SQL</p>
    </section>
  )
}

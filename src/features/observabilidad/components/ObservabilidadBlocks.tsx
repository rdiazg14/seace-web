import {
  COMPONENTE_COLOR,
  COMPONENTE_LABEL,
  RUBRO_META,
  diasDesde,
  fmtDate,
  fmtTs,
} from '../model'

export function CubsoCard({
  version,
  items,
  cargado,
}: {
  version: string
  items: number | null
  cargado: string | null
}) {
  const dias = diasDesde(version)
  const alerta = dias > 365
  return (
    <div
      className={
        alerta
          ? 'rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300'
          : 'rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800'
      }
    >
      <p className="font-medium">
        {alerta ? 'Catálogo CUBSO desactualizado' : 'Versión cargada'}
      </p>
      <p className="mt-1">
        Versión {fmtDate(version)}
        {items != null ? ` · ${items.toLocaleString('es-PE')} ítems` : ''}
        {` · ${dias.toLocaleString('es-PE')} días`}
      </p>
      {cargado && (
        <p className="mt-1 text-xs text-slate-500">Cargado {fmtTs(cargado)}</p>
      )}
      {alerta && (
        <p className="mt-2">
          Catalogo CUBSO desactualizado. Descargar la version vigente en
          gob.pe/oece -&gt; Publicaciones del SEACE -&gt; Documentos de orientacion
          (SEACE) -&gt; filtro CUBSO, y recargar con scripts/cargar_cubso.py
        </p>
      )}
    </div>
  )
}

export function RubroChip({ rubro }: { rubro: string | null }) {
  const meta = RUBRO_META[rubro ?? ''] ?? RUBRO_META.sin_clasificar
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${meta.color}1a`, color: meta.color }}
      title={meta.desc}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
      {meta.label}
    </span>
  )
}

export function ComponenteChip({ componente }: { componente: string }) {
  const color = COMPONENTE_COLOR[componente] ?? '#64748B'
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${color}1a`, color }}
    >
      {COMPONENTE_LABEL[componente] ?? componente}
    </span>
  )
}

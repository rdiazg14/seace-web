import { CHUNK_VERSION_COLOR, CHUNK_VERSION_LABEL, ETAPA_COLOR, ETAPA_LABEL } from '../model'

export function EtapaChip({ etapa }: { etapa: string | null }) {
  if (!etapa) return <span className="text-slate-400">—</span>
  const color = ETAPA_COLOR[etapa] ?? '#64748B'
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${color}1a`, color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {ETAPA_LABEL[etapa] ?? etapa}
    </span>
  )
}

export function VersionChip({ version }: { version: string }) {
  const color = CHUNK_VERSION_COLOR[version] ?? '#64748B'
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[11px] font-medium"
      style={{ backgroundColor: `${color}1a`, color }}
      title={CHUNK_VERSION_LABEL[version] ?? version}
    >
      {version}
    </span>
  )
}

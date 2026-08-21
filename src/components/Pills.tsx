export function EstadoPill({ estado }: { estado: string }) {
  const cls =
    estado === 'Vigente'
      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
      : estado === 'En Evaluación'
        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
        : 'bg-slate-500/15 text-slate-600 dark:text-slate-400'
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{estado}</span>
}

export function ObjetoPill({ objeto }: { objeto: string }) {
  return (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      {objeto}
    </span>
  )
}

export function ItPill({ cat }: { cat: string }) {
  return (
    <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:text-violet-300">
      {cat}
    </span>
  )
}

export function IaPill({ nivel }: { nivel: string }) {
  if (nivel !== 'ALTA') {
    return (
      <span className="rounded-full bg-slate-500/15 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-400">
        IA {nivel}
      </span>
    )
  }
  return (
    <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:text-red-400">
      IA ALTA
    </span>
  )
}

/** Un solo badge: categoría IT (igual que Ruta/análisis) o IA si no hay categoría. Nunca ambos. */
export function CatItIaPill({
  categoria_it,
  relevancia_ia,
}: {
  categoria_it?: string | null
  relevancia_ia?: string | null
}) {
  if (categoria_it) return <ItPill cat={categoria_it} />
  if (relevancia_ia) return <IaPill nivel={relevancia_ia} />
  return null
}

export function CierraPill({ label, tone }: { label: string; tone: string }) {
  const cls =
    tone === 'hoy' || tone === 'vencido'
      ? 'bg-red-500/15 text-red-600 dark:text-red-400'
      : tone === 'manana'
        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
        : tone === 'semana'
          ? 'bg-teal-500/15 text-teal-700 dark:text-teal-400'
          : 'bg-slate-500/15 text-slate-600 dark:text-slate-400'
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{label}</span>
}

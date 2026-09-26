import { EmptyState, ErrorBox, Skeleton } from '../../../components/ui'
import { CubsoCard } from './ObservabilidadBlocks'
import type { CubsoVersion } from '../api'

export function SeccionCubso({
  cubso,
  cubsoErr,
  cubsoLoading,
  loadCubso,
}: {
  cubso: CubsoVersion | null
  cubsoErr: string | null
  cubsoLoading: boolean
  loadCubso: () => Promise<void>
}) {
  return (
  <section className="space-y-3">
    <h2 className="text-sm font-medium">Catálogo CUBSO</h2>
    {cubsoErr && <ErrorBox retry={() => void loadCubso()}>{cubsoErr}</ErrorBox>}
    {cubsoLoading ? (
      <Skeleton className="h-28 w-full" />
    ) : !cubso ? (
      cubsoErr ? null : (
        <EmptyState
          title="Sin versión cargada"
          hint="scripts/cargar_cubso.py escribe cubso_version (id=1)."
        />
      )
    ) : (
      <CubsoCard
        version={cubso.version_catalogo}
        items={cubso.items}
        cargado={cubso.cargado_utc}
      />
    )}
  </section>
  )
}

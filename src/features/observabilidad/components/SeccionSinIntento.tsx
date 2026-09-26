import { Link } from 'react-router-dom'
import { labelCat, tipoEntidad } from '../../../lib/cats'
import { EmptyState, ErrorBox, Skeleton } from '../../../components/ui'
import { RubroChip } from './ObservabilidadBlocks'
import { fmtNum, fmtTs, RUBRO_META, type SinIntentoData } from '../model'

export function SeccionSinIntento({
  sinIntento,
  sinIntentoErr,
  sinIntentoLoading,
  sinPage,
  sinSoloTi,
  setSinPage,
  setSinSoloTi,
  loadSinIntento,
  totalPaginas,
}: {
  sinIntento: SinIntentoData | null
  sinIntentoErr: string | null
  sinIntentoLoading: boolean
  sinPage: number
  sinSoloTi: boolean
  setSinPage: React.Dispatch<React.SetStateAction<number>>
  setSinSoloTi: React.Dispatch<React.SetStateAction<boolean>>
  loadSinIntento: (page?: number, soloTi?: boolean) => Promise<void>
  totalPaginas: number
}) {
  return (
  <section className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-sm font-medium">Postulables sin intento de descarga</h2>
      <button
        onClick={() => {
          setSinSoloTi((v) => !v)
          setSinPage(0)
        }}
        className={
          sinSoloTi
            ? 'rounded-lg bg-teal-600 px-2.5 py-1 text-xs font-medium text-white'
            : 'rounded-lg border border-slate-300 px-2.5 py-1 text-xs dark:border-slate-700'
        }
      >
        Solo rubro TI
      </button>
    </div>
    <p className="text-sm text-slate-500">
      Ventana abierta, sin <span className="font-mono text-xs">pdf_storage_path</span> y
      sin <span className="font-mono text-xs">req_url</span>: el sistema los ve pero
      nunca intentó bajar el TDR, así que no pueden analizarse. El rubro (Núcleo,
      Adyacente, Oportunista, Marginal) te dice cuáles importan para tu negocio.
    </p>
    {sinIntentoErr && (
      <ErrorBox retry={() => void loadSinIntento()}>{sinIntentoErr}</ErrorBox>
    )}
    {sinIntentoLoading ? (
      <Skeleton className="h-24 w-full" />
    ) : !sinIntento ? (
      sinIntentoErr ? null : (
        <EmptyState title="Sin dato" hint="No se pudo leer fn_sin_intento." />
      )
    ) : sinIntento.total === 0 ? (
      <EmptyState
        title="Ninguno pendiente"
        hint="Todos los postulables con ventana abierta ya tienen intento de descarga."
      />
    ) : (
      <>
        {/* Resumen por rubro */}
        <div className="flex flex-wrap gap-2">
          {sinIntento.resumen.map((r) => {
            const meta = RUBRO_META[r.rubro] ?? RUBRO_META.sin_clasificar
            return (
              <button
                key={r.rubro}
                onClick={() => {
                  setSinSoloTi(r.rubro !== 'sin_clasificar')
                  setSinPage(0)
                }}
                className="flex items-center gap-2 rounded-full border border-slate-200 px-2.5 py-1 text-xs dark:border-slate-800"
                title={meta.desc}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} />
                <span>{meta.label}</span>
                <span className="font-semibold tabular-nums">{r.n}</span>
              </button>
            )
          })}
        </div>
        <p className="text-xs text-slate-500">
          {fmtNum(sinIntento.total)} en total · {fmtNum(sinIntento.total_ti)} con rubro TI ·{' '}
          página {sinPage + 1} de {totalPaginas}
        </p>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
              <tr>
                <th className="px-3 py-2 font-medium">Rubro</th>
                <th className="px-3 py-2 font-medium">Título</th>
                <th className="px-3 py-2 font-medium">Entidad</th>
                <th className="px-3 py-2 font-medium">Cierra</th>
              </tr>
            </thead>
            <tbody>
              {sinIntento.rows.map((c) => (
                <tr key={c.id} className="border-t border-slate-200 dark:border-slate-800">
                  <td className="px-3 py-2">
                    <RubroChip rubro={c.rubro} />
                    {c.categoria_it && (
                      <span className="mt-1 block text-xs text-slate-500">{labelCat(c.categoria_it)}</span>
                    )}
                    {c.relevancia_ia === 'ALTA' && (
                      <span className="mt-1 inline-block rounded-full bg-red-500/15 px-1.5 py-0.5 text-xs text-red-600 dark:text-red-400">
                        IA alta
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      to={`/analisis/${c.id}`}
                      className="font-medium text-teal-600 hover:underline dark:text-teal-400"
                    >
                      {c.titulo || `Contrato ${c.id}`}
                    </Link>
                    {c.nro && (
                      <span className="mt-0.5 block font-mono text-xs text-slate-500">{c.nro}</span>
                    )}
                    {c.objeto && (
                      <span className="mt-0.5 block text-xs text-slate-500">{c.objeto}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <span className="block">{c.entidad ?? '—'}</span>
                    {c.entidad && (
                      <span className="block text-slate-500">{tipoEntidad(c.entidad)}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {c.urgente && (
                      <span className="mr-1 rounded-full bg-red-500/15 px-1.5 py-0.5 text-xs text-red-600 dark:text-red-400">
                        ¡urgente!
                      </span>
                    )}
                    {c.dias != null ? (
                      <span>
                        {c.dias <= 0 ? 'hoy' : `en ${c.dias} d`}
                        <span className="ml-1 text-xs text-slate-500">{fmtTs(c.fecha_fin_cotizacion)}</span>
                      </span>
                    ) : (
                      <span className="text-slate-400">sin fecha</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between gap-2 text-xs">
          <button
            disabled={sinPage === 0}
            onClick={() => setSinPage((p) => Math.max(0, p - 1))}
            className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40 dark:border-slate-700"
          >
            ← Anterior
          </button>
          <span className="text-slate-500">
            {fmtNum(sinIntento.offset + 1)}–{fmtNum(Math.min(sinIntento.offset + sinIntento.rows.length, sinIntento.total))} de {fmtNum(sinIntento.total)}
          </span>
          <button
            disabled={sinPage >= totalPaginas - 1}
            onClick={() => setSinPage((p) => p + 1)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40 dark:border-slate-700"
          >
            Siguiente →
          </button>
        </div>
      </>
    )}
  </section>
  )
}

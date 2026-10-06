import { EmptyState, ErrorBox, Skeleton } from '../components/ui'
import { modelosElegibles, resumenCambio, useConfigIa } from '../features/configia/useConfigIa'
import type { Endpoint, Modelo, Proveedor } from '../features/configia/api'

const TH = 'px-3 py-2 font-medium'
const TD = 'px-3 py-2'

function Toggle({ activo, busy, onClick, label }: { activo: boolean; busy: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={label}
      disabled={busy}
      onClick={onClick}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
        activo ? 'bg-teal-600' : 'bg-slate-300 dark:bg-slate-700'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
          activo ? 'translate-x-[18px]' : 'translate-x-[2px]'
        }`}
      />
    </button>
  )
}


export default function ConfigIa() {
  const {
    data, cambios, loading, error, ok, busy, corpus,
    modelosPorId, proveedoresPorId, load,
    toggleEndpoint, asignarModelo, toggleModelo, toggleProveedor,
  } = useConfigIa()

  const endpoints = data?.endpoints ?? []
  const modelos = data?.modelos ?? []
  const proveedores = data?.proveedores ?? []

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-3 py-5 sm:px-4">
      <div>
        <h1 className="text-lg font-medium">Configuración IA</h1>
        <p className="text-sm text-slate-500">
          Proveedores, modelos y endpoints del pipeline de IA. Las mutaciones pasan por la función
          config-ia con auditoría; las claves nunca se muestran (solo máscara).
          El cambio de corpus vectorial sigue siendo operación de respaldo (failover_espacio).
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-slate-300 px-3 py-1 text-xs dark:border-slate-700">
          corpus_embeddings: <span className="font-mono">{corpus}</span>
        </span>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-full border border-slate-300 px-3 py-1 text-xs hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Recargar
        </button>
      </div>

      {error && <ErrorBox retry={() => void load()}>{error}</ErrorBox>}
      {ok && (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">
          {ok}
        </p>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Endpoints</h2>
        {loading ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full min-w-[46rem] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
                <tr>
                  <th className={TH}>Endpoint</th>
                  <th className={TH}>Activo</th>
                  <th className={TH}>Modelo asignado</th>
                  <th className={TH}>Proveedor</th>
                  <th className={TH}>Espacio vectorial</th>
                </tr>
              </thead>
              <tbody>
                {endpoints.map((ep: Endpoint) => {
                  const modelo = ep.modelo_id ? modelosPorId.get(ep.modelo_id) : undefined
                  const elegibles = modelosElegibles(ep, modelos)
                  const prov = modelo ? proveedoresPorId.get(modelo.proveedor_id) : undefined
                  const alertaEspacio = ep.endpoint === 'embeddings' && modelo?.espacio_vectorial && modelo.espacio_vectorial !== corpus
                  return (
                    <tr key={ep.endpoint} className="border-t border-slate-200 dark:border-slate-800">
                      <td className={`${TD} font-mono text-xs`}>
                        {ep.endpoint}
                        {ep.hereda && <span className="ml-2 text-slate-400">→ hereda {ep.hereda}</span>}
                      </td>
                      <td className={TD}>
                        <Toggle
                          activo={ep.activo}
                          busy={busy === `ep:${ep.endpoint}`}
                          label={`activo ${ep.endpoint}`}
                          onClick={() => void toggleEndpoint(ep)}
                        />
                      </td>
                      <td className={TD}>
                        {elegibles.length === 0 ? (
                          <span className="text-xs text-slate-500">
                            {ep.hereda ? `heredado de ${ep.hereda}` : (modelo?.modelo ?? '—')}
                          </span>
                        ) : (
                          <select
                            aria-label={`modelo de ${ep.endpoint}`}
                            className="rounded-lg border border-slate-300 bg-transparent px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                            value={ep.modelo_id ?? ''}
                            disabled={busy === `ep:${ep.endpoint}`}
                            onChange={e => void asignarModelo(ep, e.target.value || null)}
                          >
                            <option value="">— sin modelo —</option>
                            {elegibles.map(m => (
                              <option key={m.id} value={m.id}>
                                {m.modelo}{m.activo ? '' : ' (inactivo)'}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className={`${TD} text-xs`}>{prov?.id ?? '—'}</td>
                      <td className={`${TD} font-mono text-xs ${alertaEspacio ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                        {modelo?.espacio_vectorial ?? '—'}
                        {alertaEspacio && ' ≠ corpus'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-slate-500">
          El selector solo ofrece los modelos en <code>habilitados[]</code> del endpoint.
          Para embeddings, el espacio del modelo debe coincidir con el corpus activo (el servidor lo exige).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Modelos</h2>
        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
                <tr>
                  <th className={TH}>Modelo</th>
                  <th className={TH}>Proveedor</th>
                  <th className={TH}>Tipo</th>
                  <th className={TH}>Espacio</th>
                  <th className={TH}>Activo</th>
                </tr>
              </thead>
              <tbody>
                {modelos.map((m: Modelo) => (
                  <tr key={m.id} className="border-t border-slate-200 dark:border-slate-800">
                    <td className={`${TD} font-mono text-xs`}>{m.modelo}</td>
                    <td className={`${TD} text-xs`}>{m.proveedor_id}</td>
                    <td className={`${TD} text-xs`}>{m.tipo}</td>
                    <td className={`${TD} font-mono text-xs`}>{m.espacio_vectorial ?? '—'}</td>
                    <td className={TD}>
                      <Toggle
                        activo={m.activo}
                        busy={busy === `mod:${m.id}`}
                        label={`activo ${m.modelo}`}
                        onClick={() => void toggleModelo(m)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Proveedores</h2>
        {loading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
                <tr>
                  <th className={TH}>ID</th>
                  <th className={TH}>Nombre</th>
                  <th className={TH}>API</th>
                  <th className={TH}>Clave</th>
                  <th className={TH}>Activo</th>
                </tr>
              </thead>
              <tbody>
                {proveedores.map((p: Proveedor) => (
                  <tr key={p.id} className="border-t border-slate-200 dark:border-slate-800">
                    <td className={`${TD} font-mono text-xs`}>{p.id}</td>
                    <td className={TD}>{p.nombre}</td>
                    <td className={`${TD} text-xs`}>{p.tipo_api}</td>
                    <td className={`${TD} font-mono text-xs`}>{p.tiene_clave ? (p.clave_mascara ?? '•••') : '—'}</td>
                    <td className={TD}>
                      <Toggle
                        activo={p.activo}
                        busy={busy === `prov:${p.id}`}
                        label={`activo ${p.id}`}
                        onClick={() => void toggleProveedor(p)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Auditoría de cambios</h2>
        {loading ? (
          <Skeleton className="h-32 w-full" />
        ) : cambios.length === 0 ? (
          <EmptyState title="Sin cambios registrados" />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
                <tr>
                  <th className={TH}>Fecha</th>
                  <th className={TH}>Entidad</th>
                  <th className={TH}>Acción</th>
                  <th className={TH}>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {cambios.slice(0, 30).map(c => (
                  <tr key={c.id} className="border-t border-slate-200 dark:border-slate-800">
                    <td className={`${TD} whitespace-nowrap text-xs text-slate-500`}>
                      {new Date(c.created_at).toLocaleString('es-PE')}
                    </td>
                    <td className={`${TD} font-mono text-xs`}>{c.entidad}</td>
                    <td className={`${TD} text-xs`}>{c.accion}</td>
                    <td className={`${TD} max-w-[24rem] truncate font-mono text-[11px] text-slate-500`} title={resumenCambio(c)}>
                      {resumenCambio(c)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

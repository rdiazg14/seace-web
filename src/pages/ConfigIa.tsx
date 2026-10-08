import { useState } from 'react'
import { EmptyState, ErrorBox, Skeleton } from '../components/ui'
import { cadenaEfectiva, modelosElegibles, resumenCambio, useConfigIa } from '../features/configia/useConfigIa'
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


/**
 * Cadena efectiva del endpoint. En 'manual' cada habilitado tiene ↑↓ para
 * reordenar la secuencia literal; en 'auto' es solo lectura (Gemini al final).
 */
function CadenaFailover({ ep, modo, modelosPorId, busy, onReorder }: {
  ep: Endpoint
  modo: 'auto' | 'manual'
  modelosPorId: Map<string, Modelo>
  busy: boolean
  onReorder: (habilitados: string[]) => void
}) {
  const cadena = cadenaEfectiva(ep, modelosPorId, modo)
  if (cadena.length === 0) return <span className="text-xs text-slate-400">—</span>
  const habs = ep.habilitados ?? []
  // La cadena muestra [primario]+habilitados; mover opera sobre habilitados por id
  // (el primario puede estar duplicado en la lista y no moverse).
  const mover = (modeloId: string, dir: -1 | 1) => {
    const i = habs.indexOf(modeloId)
    const j = i + dir
    if (i < 0 || j < 0 || j >= habs.length) return
    const next = [...habs]
    ;[next[i], next[j]] = [next[j], next[i]]
    onReorder(next)
  }
  return (
    <ol className="flex flex-wrap items-center gap-1 text-[11px]">
      {cadena.map((m, idx) => (
        <li key={m.id} className="inline-flex items-center gap-0.5">
          {idx > 0 && <span className="text-slate-400">→</span>}
          <span
            className={`rounded px-1 py-0.5 font-mono ${
              idx === 0
                ? 'bg-teal-600/15 text-teal-700 dark:text-teal-300'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {m.modelo}
          </span>
          {modo === 'manual' && idx > 0 && habs.includes(m.id) && (
            <span className="inline-flex">
              <button type="button" aria-label={`subir ${m.modelo}`} disabled={busy || habs.indexOf(m.id) === 0}
                onClick={() => mover(m.id, -1)}
                className="px-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 dark:hover:text-slate-200">↑</button>
              <button type="button" aria-label={`bajar ${m.modelo}`} disabled={busy || habs.indexOf(m.id) === habs.length - 1}
                onClick={() => mover(m.id, 1)}
                className="px-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 dark:hover:text-slate-200">↓</button>
            </span>
          )}
        </li>
      ))}
    </ol>
  )
}

/** Saldo inicial declarado + estimado desde uso_ia (GW-008). */
function SaldoProveedor({ p, busy, onSave }: { p: Proveedor; busy: boolean; onSave: (v: number | null) => void }) {
  const [txt, setTxt] = useState(p.saldo_inicial_usd?.toString() ?? '')
  return (
    <div className="flex items-center gap-1 text-xs">
      <input
        aria-label={`saldo inicial ${p.id}`}
        value={txt}
        onChange={e => setTxt(e.target.value)}
        placeholder="—"
        inputMode="decimal"
        className="w-20 rounded border border-slate-300 bg-transparent px-1 py-0.5 font-mono dark:border-slate-700"
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          const t = txt.trim()
          onSave(t === '' ? null : Number(t))
        }}
        className="rounded border border-slate-300 px-1.5 py-0.5 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
      >
        ✓
      </button>
      {p.saldo_estimado_usd != null && (
        <span className="font-mono text-slate-500" title="Estimado: saldo inicial − consumo observado en uso_ia desde la fecha de carga">
          ≈ ${p.saldo_estimado_usd.toFixed(2)}
        </span>
      )}
    </div>
  )
}

export default function ConfigIa() {
  const {
    data, cambios, failovers, loading, error, ok, busy, corpus, modoFailover,
    modelosPorId, proveedoresPorId, load,
    toggleEndpoint, asignarModelo, reordenarHabilitados, cambiarModoFailover,
    actualizarSaldo, toggleModelo, toggleProveedor,
  } = useConfigIa()

  const endpoints = data?.endpoints ?? []
  const modelos = data?.modelos ?? []
  const proveedores = data?.proveedores ?? []

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-3 py-5 sm:px-4">
      <div>
        <h1 className="text-lg font-medium">Config</h1>
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
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 p-1 text-xs dark:border-slate-700">
          <span className="px-1 text-slate-500">failover</span>
          {(['auto', 'manual'] as const).map(m => (
            <button
              key={m}
              type="button"
              disabled={busy === 'meta:modo_failover'}
              onClick={() => void cambiarModoFailover(m)}
              className={`rounded-full px-2 py-0.5 transition disabled:opacity-50 ${
                modoFailover === m
                  ? 'bg-teal-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {m === 'auto' ? 'Automático' : 'Manual avanzado'}
            </button>
          ))}
        </span>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-full border border-slate-300 px-3 py-1 text-xs hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Recargar
        </button>
      </div>
      <p className="text-xs text-slate-500">
        {modoFailover === 'auto'
          ? 'Modo automático: la cadena es [modelo asignado] + habilitados; Gemini queda siempre de reserva final.'
          : 'Modo manual: el orden de habilitados es la cadena de failover literal (usa ↑↓ para ordenar).'}
      </p>

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
                  <th className={TH}>Cadena failover</th>
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
                      <td className={TD}>
                        <CadenaFailover
                          ep={ep}
                          modo={modoFailover}
                          modelosPorId={modelosPorId}
                          busy={busy === `ep:${ep.endpoint}`}
                          onReorder={(habs) => void reordenarHabilitados(ep, habs)}
                        />
                      </td>
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
                  <th className={TH}>Saldo (USD)</th>
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
                      <SaldoProveedor p={p} busy={busy === `prov:${p.id}`} onSave={(v) => void actualizarSaldo(p, v)} />
                    </td>
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
        <h2 className="text-sm font-medium">Historial de failover</h2>
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : failovers.length === 0 ? (
          <EmptyState title="Sin eventos de failover" />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full min-w-[46rem] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
                <tr>
                  <th className={TH}>Fecha</th>
                  <th className={TH}>Endpoint</th>
                  <th className={TH}>Salto</th>
                  <th className={TH}>Error</th>
                  <th className={TH}>Modo</th>
                  <th className={TH}>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {failovers.map(f => (
                  <tr key={f.id} className="border-t border-slate-200 dark:border-slate-800">
                    <td className={`${TD} whitespace-nowrap text-xs text-slate-500`}>
                      {new Date(f.created_at).toLocaleString('es-PE')}
                    </td>
                    <td className={`${TD} font-mono text-xs`}>{f.endpoint}</td>
                    <td className={`${TD} font-mono text-xs`}>
                      {f.de_proveedor}:{f.de_modelo} → {f.a_proveedor}:{f.a_modelo}
                    </td>
                    <td className={`${TD} text-xs`}>
                      {f.error_kind}{f.status != null ? ` (${f.status})` : ''}
                    </td>
                    <td className={`${TD} text-xs`}>{f.modo}</td>
                    <td className={`${TD} text-xs ${f.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {f.ok == null ? '—' : f.ok ? `ok${f.dur_ms != null ? ` ${f.dur_ms}ms` : ''}` : 'falló'}
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

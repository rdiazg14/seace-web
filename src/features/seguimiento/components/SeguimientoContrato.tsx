import { Link } from 'react-router-dom'
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { fmtFechaHora, haceCuanto } from '../../../lib/format'
import { EmptyState, ErrorBox, Skeleton } from '../../../components/ui'
import { EtapaChip, VersionChip } from './Chips'
import { TimelineModal } from './TimelineModal'
import { useSeguimiento } from '../useSeguimiento'
import {
  ETAPA_LABEL,
  ETAPA_ORDEN,
  fmtNum,
  fmtUsd,
  TIPO_LABEL,
} from '../model'

// ─────────────────────────────────────────────────────────────────────────────
// Seguimiento por contrato del pipeline de IA/embedding (proceso_evento).
// Sección de Observabilidad a nivel especialista: KPIs, distribuciones,
// tabla maestra filtrable/paginada y timeline de eventos por contrato.
// ─────────────────────────────────────────────────────────────────────────────

export default function SeguimientoContrato() {
  const {
    axis,
    grid,
    tipBg,
    tipFg,
    resumen,
    resumenErr,
    resumenLoading,
    loadResumen,
    tabla,
    tablaErr,
    tablaLoading,
    loadTabla,
    page,
    setPage,
    fEstado,
    setFEstado,
    fVersion,
    setFVersion,
    fEtapa,
    setFEtapa,
    busquedaInput,
    setBusquedaInput,
    setFBusqueda,
    detalle,
    setDetalle,
    paginas,
    donutEtapa,
    donutVersion,
    barrasTipo,
  } = useSeguimiento()

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium">Seguimiento por contrato (pipeline de IA)</h2>
          <p className="text-xs text-slate-500">
            Traza append-only de <span className="font-mono">proceso_evento</span>: qué se le hizo a
            cada TDR, cuántos chunks generó, cuánto costó su embedding y a qué hora.
          </p>
        </div>
      </div>

      {resumenErr && <ErrorBox retry={() => void loadResumen()}>{resumenErr}</ErrorBox>}

      {resumenLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : !resumen ? (
        resumenErr ? null : (
          <EmptyState title="Sin datos" hint="No hay filas en proceso_evento todavía." />
        )
      ) : (
        <>
          {/* ── KPIs ─────────────────────────────────────────────── */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
              <p className="font-medium">Contratos trazados</p>
              <p className="mt-2 text-2xl tabular-nums">{fmtNum(resumen.contratos_con_eventos)}</p>
              <p className="mt-1 text-xs text-slate-500">{fmtNum(resumen.eventos_total)} eventos</p>
            </div>
            <div className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
              <p className="font-medium">Chunks generados</p>
              <p className="mt-2 text-2xl tabular-nums">{fmtNum(resumen.chunks_total)}</p>
              <p className="mt-1 text-xs text-slate-500 tabular-nums">
                pdf {fmtNum(resumen.chunks_pdf)} · api {fmtNum(resumen.chunks_api)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
              <p className="font-medium">Embeddings v2</p>
              <p className="mt-2 text-2xl tabular-nums">{fmtNum(resumen.embebidos_v2)}</p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-violet-500"
                  style={{ width: `${Math.min(100, resumen.cobertura_emb_pct)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-slate-500 tabular-nums">
                cobertura {resumen.cobertura_emb_pct.toFixed(2)}%
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
              <p className="font-medium">Costo de embedding</p>
              <p className="mt-2 text-2xl tabular-nums">{fmtUsd(resumen.costo_embed_usd)}</p>
              <p className="mt-1 text-xs text-slate-500 tabular-nums">
                ~{fmtNum(resumen.tokens_embed_est)} tokens · gemini-embedding-001
              </p>
            </div>
          </div>

          {resumen.ultimo_evento_at && (
            <p className="text-xs text-slate-500">
              Último evento {fmtFechaHora(resumen.ultimo_evento_at)} ({haceCuanto(resumen.ultimo_evento_at)}) ·
              primer evento {fmtFechaHora(resumen.primer_evento_at)}
            </p>
          )}

          {/* ── Eventos por día + costo ──────────────────────────── */}
          {resumen.por_dia.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <p className="mb-1 text-xs text-slate-500">Eventos y costo de embedding por día (Lima)</p>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={resumen.por_dia}>
                  <CartesianGrid stroke={grid} vertical={false} />
                  <XAxis dataKey="dia" tick={{ fill: axis, fontSize: 10 }} />
                  <YAxis yAxisId="left" tick={{ fill: axis, fontSize: 10 }} width={40} allowDecimals={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: axis, fontSize: 10 }} width={40} />
                  <Tooltip
                    contentStyle={{ background: tipBg, border: '1px solid #334155', color: tipFg }}
                    formatter={(v, name) => (name === 'Costo USD' ? fmtUsd(Number(v)) : fmtNum(Number(v)))}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="left" dataKey="eventos" fill="#6366F1" radius={[3, 3, 0, 0]} name="Eventos" />
                  <Line yAxisId="right" type="monotone" dataKey="costo_usd" stroke="#14B8A6" strokeWidth={2} dot={{ r: 2 }} name="Costo USD" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Distribuciones ───────────────────────────────────── */}
          <div className="grid gap-3 lg:grid-cols-3">
            {/* Donut por etapa */}
            <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <p className="mb-1 text-xs text-slate-500">Eventos por etapa</p>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={donutEtapa} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2} stroke="none">
                    {donutEtapa.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: tipBg, border: '1px solid #334155', color: tipFg }}
                    formatter={(v) => fmtNum(Number(v))}
                  />
                </PieChart>
              </ResponsiveContainer>
              <ul className="mt-2 space-y-1">
                {donutEtapa.map((d) => (
                  <li key={d.name} className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: d.color }} />
                      {d.name}
                    </span>
                    <span className="tabular-nums text-slate-500">{fmtNum(d.value)} · {d.pct.toFixed(1)}%</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Donut por chunk_version */}
            <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <p className="mb-1 text-xs text-slate-500">Contratos por chunk_version</p>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={donutVersion} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2} stroke="none">
                    {donutVersion.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: tipBg, border: '1px solid #334155', color: tipFg }}
                    formatter={(v) => fmtNum(Number(v))}
                  />
                </PieChart>
              </ResponsiveContainer>
              <ul className="mt-2 space-y-1">
                {donutVersion.map((d) => (
                  <li key={d.name} className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: d.color }} />
                      {d.name}
                    </span>
                    <span className="tabular-nums text-slate-500">{fmtNum(d.value)} · {d.pct.toFixed(1)}%</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Bar por tipo de extracción */}
            <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <p className="mb-1 text-xs text-slate-500">Contratos por tipo de extracción</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barrasTipo} layout="vertical" margin={{ left: 8, right: 12 }}>
                  <CartesianGrid stroke={grid} horizontal={false} />
                  <XAxis type="number" tick={{ fill: axis, fontSize: 10 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={82} tick={{ fill: axis, fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ background: tipBg, border: '1px solid #334155', color: tipFg }}
                    formatter={(v) => fmtNum(Number(v))}
                  />
                  <Bar dataKey="value" fill="#F59E0B" radius={[0, 3, 3, 0]} name="Contratos" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {/* ── Filtros + tabla maestra ──────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
        <label className="text-xs">
          <span className="mb-1 block text-slate-500">Buscar (nro / descripción)</span>
          <input
            type="text"
            value={busquedaInput}
            placeholder="CM-984, entidad…"
            onChange={(e) => setBusquedaInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setPage(0)
                setFBusqueda(busquedaInput.trim())
              }
            }}
            className="w-48 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
        <label className="text-xs">
          <span className="mb-1 block text-slate-500">Estado</span>
          <select
            value={fEstado}
            onChange={(e) => {
              setFEstado(e.target.value)
              setPage(0)
            }}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="">Todos</option>
            {['Vigente', 'En Evaluación', 'Culminado'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          <span className="mb-1 block text-slate-500">Chunk version</span>
          <select
            value={fVersion}
            onChange={(e) => {
              setFVersion(e.target.value)
              setPage(0)
            }}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="">Todas</option>
            <option value="500_0">500/0 (legacy)</option>
            <option value="300_60">300/60 (overlap)</option>
          </select>
        </label>
        <label className="text-xs">
          <span className="mb-1 block text-slate-500">Última etapa</span>
          <select
            value={fEtapa}
            onChange={(e) => {
              setFEtapa(e.target.value)
              setPage(0)
            }}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="">Todas</option>
            {ETAPA_ORDEN.map((e) => (
              <option key={e} value={e}>{ETAPA_LABEL[e]}</option>
            ))}
          </select>
        </label>
      </div>

      {tablaErr && <ErrorBox retry={() => void loadTabla()}>{tablaErr}</ErrorBox>}

      {tablaLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : !tabla ? (
        tablaErr ? null : (
          <EmptyState title="Sin datos" hint="No se pudo leer fn_seguimiento_contrato." />
        )
      ) : tabla.total === 0 ? (
        <EmptyState title="Sin resultados" hint="Ningún contrato coincide con los filtros." />
      ) : (
        <>
          <p className="text-xs text-slate-500">
            {fmtNum(tabla.total)} contratos · página {page + 1} de {paginas}
          </p>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full min-w-[64rem] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
                <tr>
                  <th className="px-3 py-2 font-medium">Contrato</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 font-medium">Versión</th>
                  <th className="px-3 py-2 text-right font-medium">Chunks pdf</th>
                  <th className="px-3 py-2 text-right font-medium">Chunks api</th>
                  <th className="px-3 py-2 text-right font-medium">Emb. v2</th>
                  <th className="px-3 py-2 text-right font-medium">Costo embed</th>
                  <th className="px-3 py-2 font-medium">Última etapa</th>
                  <th className="px-3 py-2 font-medium">Último evento</th>
                  <th className="px-3 py-2 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {tabla.filas.map((c) => {
                  const pct = c.n_chunks_total > 0 ? (c.n_embebidos_v2 / c.n_chunks_total) * 100 : 0
                  return (
                    <tr key={c.contrato_id} className="border-t border-slate-200 dark:border-slate-800">
                      <td className="px-3 py-2">
                        <Link
                          to={`/analisis/${c.contrato_id}`}
                          className="font-medium text-teal-600 hover:underline dark:text-teal-400"
                        >
                          {c.descripcion || `Contrato ${c.contrato_id}`}
                        </Link>
                        <span className="mt-0.5 block font-mono text-xs text-slate-500">
                          {c.nro_contratacion ?? `#${c.contrato_id}`}
                        </span>
                        {c.tdr_tipo_extraccion && (
                          <span className="mt-0.5 block text-[11px] text-slate-400">
                            {TIPO_LABEL[c.tdr_tipo_extraccion] ?? c.tdr_tipo_extraccion}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">{c.estado ?? '—'}</td>
                      <td className="px-3 py-2"><VersionChip version={c.chunk_version} /></td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtNum(c.n_chunks_pdf)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtNum(c.n_chunks_api)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        <span className="font-medium">{fmtNum(c.n_embebidos_v2)}</span>
                        <span className="ml-1 text-xs text-slate-400">({pct.toFixed(0)}%)</span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtUsd(c.costo_embed_acum)}</td>
                      <td className="px-3 py-2"><EtapaChip etapa={c.ultima_etapa} /></td>
                      <td className="px-3 py-2 text-xs">
                        <span className="block">{fmtFechaHora(c.ultimo_evento_at)}</span>
                        <span className="block text-slate-400">{haceCuanto(c.ultimo_evento_at)}</span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => setDetalle(c)}
                          className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium hover:border-teal-400 dark:border-slate-700"
                        >
                          timeline
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-2 text-xs">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40 dark:border-slate-700"
            >
              ← Anterior
            </button>
            <span className="text-slate-500">
              página {page + 1} de {paginas}
            </span>
            <button
              disabled={page >= paginas - 1}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40 dark:border-slate-700"
            >
              Siguiente →
            </button>
          </div>
        </>
      )}

      {detalle && <TimelineModal contrato={detalle} onClose={() => setDetalle(null)} />}
    </section>
  )
}

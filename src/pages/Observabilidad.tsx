import { Link } from 'react-router-dom'
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { labelCat, tipoEntidad } from '../lib/cats'
import { EmptyState, ErrorBox, Skeleton } from '../components/ui'
import SeguimientoContrato from '../features/seguimiento/components/SeguimientoContrato'
import { CubsoCard, RubroChip, ComponenteChip } from '../features/observabilidad/components/ObservabilidadBlocks'
import { useObservabilidad } from '../features/observabilidad/useObservabilidad'
import {
  COMPONENTE_LABEL,
  RUBRO_META,
  TIPO_LABEL,
  fmtUsd,
  fmtNum,
  fmtTs,
  fmtDate,
  isoDiasAtras,
  localIso,
  type TipoRespuesta,
} from '../features/observabilidad/model'

export default function Observabilidad() {
  const {
    axis,
    grid,
    tipBg,
    tipFg,
    stats,
    statsErr,
    statsLoading,
    loadStats,
    cubso,
    cubsoErr,
    cubsoLoading,
    loadCubso,
    uso,
    usoErr,
    usoLoading,
    usoDesde,
    usoHasta,
    modeloFiltro,
    compFiltro,
    modelos,
    setUsoDesde,
    setUsoHasta,
    setModeloFiltro,
    setCompFiltro,
    loadUso,
    sinIntento,
    sinIntentoErr,
    sinIntentoLoading,
    sinPage,
    sinSoloTi,
    setSinPage,
    setSinSoloTi,
    loadSinIntento,
    lastErr,
    lastOk,
    tokenExpira,
    diasToken,
    triggerStale,
    triggerSinOk,
    tokenCls,
    kvRows,
    compBars,
    donut,
    totalPaginas,
  } = useObservabilidad()

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-3 py-5 sm:px-4">
      <div>
        <h1 className="text-lg font-medium">Observabilidad</h1>
        <p className="text-sm text-slate-500">
          Solo lectura · consumo de IA, cupos y caché en UTC · sin llamadas a Gemini.
        </p>
        <p className="mt-2 text-sm">
          <Link to="/dashboard" className="font-medium text-teal-600 hover:underline dark:text-teal-400">
            KPIs de conversión y negocio → Dashboard
          </Link>
        </p>
      </div>

      {/* ── Pipeline trigger ─────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium">Pipeline trigger</h2>
        {statsErr && <ErrorBox retry={() => void loadStats()}>{statsErr}</ErrorBox>}
        {statsLoading ? (
          <Skeleton className="h-28 w-full" />
        ) : stats ? (
          <div className="space-y-3">
            {triggerStale && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                <p className="font-medium">
                  El trigger no dispara desde {fmtTs(lastOk?.timestamp ?? null)}
                </p>
                <p className="mt-1">
                  Más de 36 h sin un dispatch OK. Si el PAT venció (401), renovar
                  en GitHub y <span className="font-mono text-xs">wrangler secret put GITHUB_PAT</span>.
                </p>
              </div>
            )}
            {triggerSinOk && !triggerStale && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
                <p className="font-medium">Sin last-ok todavía</p>
                <p className="mt-1">
                  El Worker escribe esta marca en el próximo cron (09:00 Lima) o
                  en un POST de prueba. No es una falla por sí sola.
                </p>
              </div>
            )}
            {!triggerStale && lastOk && (
              <div className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
                <p className="font-medium">Último dispatch OK</p>
                <p className="mt-1">
                  {fmtTs(lastOk.timestamp)}
                  {lastOk.source ? ` · ${lastOk.source}` : ''}
                  {lastOk.status != null ? ` · HTTP ${lastOk.status}` : ''}
                </p>
              </div>
            )}
            {lastErr && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                <p className="font-medium">Último error del pipeline-trigger</p>
                <p className="mt-1">
                  HTTP {lastErr.status ?? '—'} · {fmtTs(lastErr.timestamp)}
                  {lastErr.source ? ` · ${lastErr.source}` : ''}
                </p>
                {lastErr.status === 401 && (
                  <p className="mt-1">
                    401 = PAT expirado o revocado. Regenerar token_seace_monitor
                    y cargar GITHUB_PAT en Cloudflare.
                  </p>
                )}
                {lastErr.body && (
                  <p className="mt-2 whitespace-pre-wrap break-all font-mono text-xs">{lastErr.body}</p>
                )}
              </div>
            )}
            {tokenExpira ? (
              <div className={tokenCls}>
                <p className="font-medium">Token GitHub (GITHUB_PAT)</p>
                <p className="mt-1">
                  Vence el {fmtDate(tokenExpira.expira)} ·{' '}
                  {diasToken !== null && diasToken < 0
                    ? 'vencido'
                    : `en ${diasToken} días`}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  github-authentication-token-expiration · leído {fmtTs(tokenExpira.leido_utc)}
                  {tokenExpira.source ? ` · ${tokenExpira.source}` : ''}
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
                <p className="font-medium">Token GitHub (GITHUB_PAT)</p>
                <p className="mt-1">
                  Sin dato de expiración todavía: lo escribe el trigger en el
                  próximo dispatch (cron 09:00 Lima o POST de prueba).
                </p>
              </div>
            )}
          </div>
        ) : null}
      </section>

      {/* ── Consumo de IA ────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Consumo de IA (traza unificada)</h2>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => {
                  setUsoDesde(isoDiasAtras(d))
                  setUsoHasta(localIso(new Date()))
                }}
                className="rounded-lg border border-slate-300 px-2.5 py-1 dark:border-slate-700"
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
          <label className="text-xs">
            <span className="mb-1 block text-slate-500">Desde</span>
            <input
              type="date"
              value={usoDesde}
              onChange={(e) => setUsoDesde(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
          <label className="text-xs">
            <span className="mb-1 block text-slate-500">Hasta</span>
            <input
              type="date"
              value={usoHasta}
              onChange={(e) => setUsoHasta(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
          <label className="text-xs">
            <span className="mb-1 block text-slate-500">Modelo</span>
            <select
              value={modeloFiltro}
              onChange={(e) => setModeloFiltro(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="">Todos</option>
              {modelos.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            <span className="mb-1 block text-slate-500">Componente</span>
            <select
              value={compFiltro}
              onChange={(e) => setCompFiltro(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="">Todos</option>
              {Object.keys(COMPONENTE_LABEL).map((k) => (
                <option key={k} value={k}>{COMPONENTE_LABEL[k]}</option>
              ))}
            </select>
          </label>
        </div>

        <p className="text-sm text-slate-500">
          Tokens reales (usageMetadata) y costo estimado de todos los componentes:
          chat, cotizar, analizar, OCR, embeddings y clasificación. El costo se calcula
          con la tarifa por modelo (input + output + razonamiento).
        </p>

        {usoErr && <ErrorBox retry={() => void loadUso()}>{usoErr}</ErrorBox>}
        {usoLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : !uso ? (
          usoErr ? null : (
            <EmptyState title="Sin datos" hint="No hay filas en uso_ia todavía." />
          )
        ) : (
          <div className="space-y-3">
            {/* Totales */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
                <p className="font-medium">Llamadas</p>
                <p className="mt-2 text-2xl tabular-nums">{fmtNum(uso.total.llamadas)}</p>
                <p className="mt-1 text-xs text-slate-500">{uso.desde} → {uso.hasta}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
                <p className="font-medium">Tokens totales</p>
                <p className="mt-2 text-2xl tabular-nums">{fmtNum(uso.total.tokens_total)}</p>
                <p className="mt-1 text-xs text-slate-500 tabular-nums">
                  prompt {fmtNum(uso.total.tokens_prompt)} · comp {fmtNum(uso.total.tokens_completion)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
                <p className="font-medium">Costo estimado</p>
                <p className="mt-2 text-2xl tabular-nums">{fmtUsd(uso.total.costo_usd)}</p>
                <p className="mt-1 text-xs text-slate-500">USD · Gemini prepago</p>
              </div>
              <div className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
                <p className="font-medium">Costo por llamada</p>
                <p className="mt-2 text-2xl tabular-nums">
                  {fmtUsd(uso.total.llamadas > 0 ? uso.total.costo_usd / uso.total.llamadas : 0)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  thoughts {fmtNum(uso.total.tokens_thoughts)} · cached {fmtNum(uso.total.tokens_cached)}
                </p>
              </div>
            </div>

            {/* Trend costo + llamadas */}
            {uso.por_dia.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                <p className="mb-1 text-xs text-slate-500">Costo (USD) y llamadas por día</p>
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart data={uso.por_dia}>
                    <CartesianGrid stroke={grid} vertical={false} />
                    <XAxis dataKey="dia" tick={{ fill: axis, fontSize: 10 }} />
                    <YAxis yAxisId="left" tick={{ fill: axis, fontSize: 10 }} width={44} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: axis, fontSize: 10 }} width={30} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: tipBg, border: '1px solid #334155', color: tipFg }}
                      formatter={(v) => fmtUsd(Number(v))}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar yAxisId="left" dataKey="costo_usd" fill="#14B8A6" radius={[3, 3, 0, 0]} name="Costo USD" />
                    <Line yAxisId="right" type="monotone" dataKey="llamadas" stroke="#6366F1" strokeWidth={2} dot={{ r: 2 }} name="Llamadas" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Stacked tokens por componente */}
            {compBars.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                <p className="mb-1 text-xs text-slate-500">Tokens por componente (prompt vs completion)</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={compBars}>
                    <CartesianGrid stroke={grid} vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: axis, fontSize: 11 }} interval={0} />
                    <YAxis tick={{ fill: axis, fontSize: 10 }} width={48} />
                    <Tooltip
                      contentStyle={{ background: tipBg, border: '1px solid #334155', color: tipFg }}
                      formatter={(v) => fmtNum(Number(v))}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Prompt" stackId="a" fill="#14B8A6" />
                    <Bar dataKey="Completion" stackId="a" fill="#6366F1" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Donut costo por componente */}
            {donut.length > 0 && (
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                  <p className="mb-1 text-xs text-slate-500">Costo por componente</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={donut}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {donut.map((d, i) => (
                          <Cell key={i} fill={d.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: tipBg, border: '1px solid #334155', color: tipFg }}
                        formatter={(v) => fmtUsd(Number(v))}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
                  <p className="mb-2 text-xs text-slate-500">Participación del costo</p>
                  <ul className="space-y-2">
                    {donut.map((d) => (
                      <li key={d.name} className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: d.color }} />
                          {d.name}
                        </span>
                        <span className="tabular-nums">
                          {fmtUsd(d.value)} · {d.pct.toFixed(1)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Por modelo */}
            {uso.por_modelo.length > 0 && (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full min-w-[46rem] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
                    <tr>
                      <th className="px-3 py-2 font-medium">Modelo</th>
                      <th className="px-3 py-2 text-right font-medium">Llamadas</th>
                      <th className="px-3 py-2 text-right font-medium">Prompt</th>
                      <th className="px-3 py-2 text-right font-medium">Completion</th>
                      <th className="px-3 py-2 text-right font-medium">Thoughts</th>
                      <th className="px-3 py-2 text-right font-medium">Total</th>
                      <th className="px-3 py-2 text-right font-medium">Costo</th>
                      <th className="px-3 py-2 text-right font-medium">$/llamada</th>
                      <th className="px-3 py-2 text-right font-medium">Lat. prom.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uso.por_modelo.map((m) => (
                      <tr key={m.modelo} className="border-t border-slate-200 dark:border-slate-800">
                        <td className="px-3 py-2 font-mono text-xs">{m.modelo}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(m.llamadas)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(m.tokens_prompt)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(m.tokens_completion)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(m.tokens_thoughts)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(m.tokens_total)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtUsd(m.costo_usd)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {fmtUsd(m.llamadas > 0 ? m.costo_usd / m.llamadas : 0)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {m.latencia_promedio_ms > 0 ? `${fmtNum(m.latencia_promedio_ms)} ms` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Por usuario */}
            {uso.por_usuario.length > 0 && (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full min-w-[32rem] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
                    <tr>
                      <th className="px-3 py-2 font-medium">Usuario</th>
                      <th className="px-3 py-2 text-right font-medium">Llamadas</th>
                      <th className="px-3 py-2 text-right font-medium">Tokens</th>
                      <th className="px-3 py-2 text-right font-medium">Costo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uso.por_usuario.map((u) => (
                      <tr key={u.user_id} className="border-t border-slate-200 dark:border-slate-800">
                        <td className="px-3 py-2">
                          <span className="block">{u.email}</span>
                          <span className="block font-mono text-xs text-slate-500">{u.user_id}</span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(u.llamadas)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(u.tokens_total)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtUsd(u.costo_usd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Por contrato */}
            {uso.por_contrato.length > 0 && (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full min-w-[36rem] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
                    <tr>
                      <th className="px-3 py-2 font-medium">Proyecto</th>
                      <th className="px-3 py-2 text-right font-medium">Llamadas</th>
                      <th className="px-3 py-2 text-right font-medium">Tokens</th>
                      <th className="px-3 py-2 text-right font-medium">Costo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uso.por_contrato.map((c) => (
                      <tr key={c.contrato_id} className="border-t border-slate-200 dark:border-slate-800">
                        <td className="px-3 py-2">
                          <Link
                            to={`/analisis/${c.contrato_id}`}
                            className="font-medium text-teal-600 hover:underline dark:text-teal-400"
                          >
                            {c.titulo || `Contrato ${c.contrato_id}`}
                          </Link>
                          {c.nro && <span className="mt-0.5 block font-mono text-xs text-slate-500">{c.nro}</span>}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(c.llamadas)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(c.tokens_total)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtUsd(c.costo_usd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Feed de actividad reciente */}
            {uso.recientes.length > 0 && (
              <div className="space-y-1">
                <h3 className="text-xs font-medium text-slate-500">
                  Actividad reciente (quién gastó, en qué proyecto y a qué hora)
                </h3>
                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full min-w-[52rem] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
                      <tr>
                        <th className="px-3 py-2 font-medium">Hora (UTC)</th>
                        <th className="px-3 py-2 font-medium">Componente</th>
                        <th className="px-3 py-2 font-medium">Modelo</th>
                        <th className="px-3 py-2 font-medium">Usuario</th>
                        <th className="px-3 py-2 font-medium">Proyecto</th>
                        <th className="px-3 py-2 text-right font-medium">Tokens</th>
                        <th className="px-3 py-2 text-right font-medium">Costo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uso.recientes.map((r, i) => (
                        <tr key={i} className="border-t border-slate-200 dark:border-slate-800">
                          <td className="px-3 py-2 tabular-nums text-xs">{r.hora}</td>
                          <td className="px-3 py-2">
                            <ComponenteChip componente={r.componente} />
                            {r.cache_hit === true && (
                              <span className="ml-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-xs text-emerald-600 dark:text-emerald-400">hit</span>
                            )}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">{r.modelo ?? '—'}</td>
                          <td className="px-3 py-2 text-xs">{r.user_email}</td>
                          <td className="px-3 py-2 text-xs">
                            {r.contrato_id ? (
                              <Link
                                to={`/analisis/${r.contrato_id}`}
                                className="text-teal-600 hover:underline dark:text-teal-400"
                              >
                                {r.titulo || `#${r.contrato_id}`}
                              </Link>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                            {r.tipo_respuesta && (
                              <span className="mt-0.5 block text-slate-500">
                                {TIPO_LABEL[r.tipo_respuesta as TipoRespuesta] ?? r.tipo_respuesta}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{r.tokens_total > 0 ? fmtNum(r.tokens_total) : '—'}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmtUsd(r.costo_usd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Cupos y caché ───────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium">Cupos y caché (hoy UTC)</h2>
        <p className="text-sm text-slate-500">
          Contadores diarios del Worker (KV). El detalle de quién gastó, en qué
          proyecto y a qué hora está en la sección de consumo de IA de arriba.
        </p>
        {statsErr && <ErrorBox retry={() => void loadStats()}>{statsErr}</ErrorBox>}
        {statsLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : stats ? (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
                <tr>
                  <th className="px-3 py-2 font-medium">Métrica</th>
                  <th className="px-3 py-2 font-medium">Clave KV</th>
                  <th className="px-3 py-2 font-medium">Hoy</th>
                </tr>
              </thead>
              <tbody>
                {kvRows.map((r) => (
                  <tr key={r.clave} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="px-3 py-2">{r.label}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-500">{r.clave}</td>
                    <td className="px-3 py-2 tabular-nums">{r.valor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {/* ── Postulables sin intento ──────────────────────────────────── */}
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

      {/* ── Catálogo CUBSO ───────────────────────────────────────────── */}
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

      {/* ── Seguimiento por contrato (pipeline de IA) ─────────────────── */}
      <SeguimientoContrato />
    </div>
  )
}

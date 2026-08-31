import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { AI_PROXY, supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useTheme } from '../lib/theme'
import { EmptyState, ErrorBox, Skeleton } from '../components/ui'

const TIPOS = ['texto', 'tabla', 'grafica', 'tabla_grafica'] as const
type TipoRespuesta = (typeof TIPOS)[number]

const TIPO_LABEL: Record<TipoRespuesta, string> = {
  texto: 'Texto',
  tabla: 'Tabla',
  grafica: 'Gráfica',
  tabla_grafica: 'Tabla + gráfica',
}

interface LastError {
  status: number | null
  body: string
  timestamp: string | null
}

interface AdminStats {
  day: string
  kv: {
    flash: number
    analyze: number
    cotizar: number
    cotizar_tipo: Record<TipoRespuesta, number>
    chat_cache: { hit: number; miss: number }
    pipeline_trigger_last_error: LastError | null
  }
}

function since14dIso(): string {
  return new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
}

function fmtTs(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('es-PE')
}

export default function Observabilidad() {
  const { session } = useAuth()
  const { theme } = useTheme()
  const axis = theme === 'dark' ? '#94a3b8' : '#64748b'
  const grid = theme === 'dark' ? '#1e293b' : '#e2e8f0'
  const tipBg = theme === 'dark' ? '#0f172a' : '#fff'
  const tipFg = theme === 'dark' ? '#e2e8f0' : '#0f172a'

  const [stats, setStats] = useState<AdminStats | null>(null)
  const [statsErr, setStatsErr] = useState<string | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  const [tipoCounts, setTipoCounts] = useState<Record<string, number> | null>(null)
  const [tipoTotal, setTipoTotal] = useState(0)
  const [tipoErr, setTipoErr] = useState<string | null>(null)
  const [tipoLoading, setTipoLoading] = useState(true)

  async function loadStats() {
    setStatsLoading(true)
    setStatsErr(null)
    const token = session?.access_token
    if (!token) {
      setStatsErr('No hay sesión.')
      setStatsLoading(false)
      return
    }
    try {
      const res = await fetch(`${AI_PROXY}/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = await res.json().catch(() => ({})) as { error?: string; day?: string; kv?: AdminStats['kv'] }
      if (!res.ok) {
        const msg = res.status === 401
          ? 'Sesión inválida o expirada.'
          : res.status === 403
            ? 'No tenés permiso de admin.'
            : res.status === 503
              ? 'El proxy no pudo leer los contadores.'
              : (body.error || `HTTP ${res.status}`)
        setStatsErr(msg)
        setStats(null)
        return
      }
      if (!body.day || !body.kv) {
        setStatsErr('Respuesta incompleta del proxy.')
        setStats(null)
        return
      }
      setStats(body as AdminStats)
    } catch (e) {
      setStatsErr(e instanceof Error ? e.message : 'No se pudo leer /admin/stats')
      setStats(null)
    } finally {
      setStatsLoading(false)
    }
  }

  async function loadTipos() {
    setTipoLoading(true)
    setTipoErr(null)
    const { data, error } = await supabase
      .from('cotizar_tipo_log')
      .select('tipo_respuesta')
      .gte('created_at', since14dIso())
    if (error) {
      setTipoErr(error.message)
      setTipoCounts(null)
      setTipoLoading(false)
      return
    }
    const counts: Record<string, number> = {
      texto: 0,
      tabla: 0,
      grafica: 0,
      tabla_grafica: 0,
    }
    for (const row of data ?? []) {
      const t = typeof row.tipo_respuesta === 'string' ? row.tipo_respuesta : 'otro'
      counts[t] = (counts[t] ?? 0) + 1
    }
    setTipoCounts(counts)
    setTipoTotal((data ?? []).length)
    setTipoLoading(false)
  }

  useEffect(() => {
    void loadStats()
    void loadTipos()
    // session.access_token basta; no re-fetch en cada render del objeto session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token])

  const lastErr = stats?.kv.pipeline_trigger_last_error ?? null

  const kvRows = useMemo(() => {
    if (!stats) return []
    const { kv } = stats
    return [
      { clave: `flash:${stats.day}`, label: 'Flash (chat RAG)', valor: kv.flash },
      { clave: `analyze:${stats.day}`, label: 'Analizar (MISS)', valor: kv.analyze },
      { clave: `cotizar:${stats.day}`, label: 'Cotizar (MISS)', valor: kv.cotizar },
      { clave: `cotizar_tipo:texto:${stats.day}`, label: 'Cotizar tipo · texto', valor: kv.cotizar_tipo.texto },
      { clave: `cotizar_tipo:tabla:${stats.day}`, label: 'Cotizar tipo · tabla', valor: kv.cotizar_tipo.tabla },
      { clave: `cotizar_tipo:grafica:${stats.day}`, label: 'Cotizar tipo · gráfica', valor: kv.cotizar_tipo.grafica },
      { clave: `cotizar_tipo:tabla_grafica:${stats.day}`, label: 'Cotizar tipo · tabla+gráfica', valor: kv.cotizar_tipo.tabla_grafica },
      { clave: `chat_cache:hit:${stats.day}`, label: 'Caché chat · hit', valor: kv.chat_cache.hit },
      { clave: `chat_cache:miss:${stats.day}`, label: 'Caché chat · miss', valor: kv.chat_cache.miss },
    ]
  }, [stats])

  const tipoBars = useMemo(() => {
    if (!tipoCounts) return []
    const known = TIPOS.map((t) => ({
      tipo: TIPO_LABEL[t],
      n: tipoCounts[t] ?? 0,
    }))
    const extra = Object.keys(tipoCounts)
      .filter((k) => !TIPOS.includes(k as TipoRespuesta))
      .map((k) => ({ tipo: k, n: tipoCounts[k] ?? 0 }))
    return [...known, ...extra]
  }, [tipoCounts])

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-3 py-5 sm:px-4">
      <div>
        <h1 className="text-lg font-medium">Observabilidad</h1>
        <p className="text-sm text-slate-500">
          Solo lectura · cupos y caché en UTC · sin llamadas a Gemini.
        </p>
        <p className="mt-2 text-sm">
          <Link to="/" className="font-medium text-teal-600 hover:underline dark:text-teal-400">
            KPIs de conversión y negocio → Dashboard
          </Link>
        </p>
      </div>

      {lastErr && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <p className="font-medium">Último error del pipeline-trigger</p>
          <p className="mt-1">
            HTTP {lastErr.status ?? '—'} · {fmtTs(lastErr.timestamp)}
          </p>
          {lastErr.body && (
            <p className="mt-2 whitespace-pre-wrap break-all font-mono text-xs">{lastErr.body}</p>
          )}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Cupos y caché (hoy UTC)</h2>
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

      <section className="space-y-3">
        <h2 className="text-sm font-medium">tipo_respuesta · últimos 14 días</h2>
        {tipoErr && <ErrorBox retry={() => void loadTipos()}>{tipoErr}</ErrorBox>}
        {tipoLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : !tipoCounts ? (
          tipoErr ? null : <EmptyState title="Sin distribución" hint="No se pudo leer cotizar_tipo_log." />
        ) : tipoTotal === 0 ? (
          <EmptyState title="Sin eventos en 14 días" hint="Los MISS de /cotizar quedan acá." />
        ) : (
          <>
            <p className="text-xs text-slate-500">{tipoTotal.toLocaleString('es-PE')} eventos</p>
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="w-full min-w-[16rem] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
                  <tr>
                    <th className="px-3 py-2 font-medium">tipo_respuesta</th>
                    <th className="px-3 py-2 font-medium">Eventos</th>
                  </tr>
                </thead>
                <tbody>
                  {tipoBars.map((r) => (
                    <tr key={r.tipo} className="border-t border-slate-200 dark:border-slate-800">
                      <td className="px-3 py-2">{r.tipo}</td>
                      <td className="px-3 py-2 tabular-nums">{r.n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={tipoBars} barSize={28}>
                  <CartesianGrid stroke={grid} vertical={false} />
                  <XAxis dataKey="tipo" tick={{ fill: axis, fontSize: 11 }} interval={0} />
                  <YAxis tick={{ fill: axis, fontSize: 11 }} width={28} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: tipBg, border: '1px solid #334155', color: tipFg }}
                  />
                  <Bar dataKey="n" fill="#14B8A6" radius={[4, 4, 0, 0]} name="Eventos" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

import { ErrorBox, Skeleton } from '../../../components/ui'
import { fmtDate, fmtTs, type AdminStats, type EstadoTrigger } from '../model'

export function SeccionTrigger({
  stats,
  statsErr,
  statsLoading,
  loadStats,
  trigger,
}: {
  stats: AdminStats | null
  statsErr: string | null
  statsLoading: boolean
  loadStats: () => Promise<void>
  trigger: EstadoTrigger
}) {
  const { lastErr, lastOk, tokenExpira, diasToken, triggerStale, triggerSinOk, tokenCls } = trigger
  return (
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
  )
}

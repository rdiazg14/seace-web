import { EstadoPill } from '../../../components/Pills'
import { MarkdownRenderer } from '../../../components/MarkdownRenderer'
import type { Contrato, ContratoRef } from '../../../types'
import type { ChatMsg } from '../model'

export function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden>
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-500 [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-500 [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-500" />
    </span>
  )
}

function CitaFuente({
  cita,
  contrato,
  onSimilares,
}: {
  cita: ContratoRef
  contrato?: Contrato
  onSimilares?: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[11px] font-medium text-teal-700 dark:text-teal-400">{cita.nro}</p>
        <p className="truncate text-xs text-slate-600 dark:text-slate-300">{cita.entidad || 'Entidad no indicada'}</p>
      </div>
      {cita.estado && <EstadoPill estado={cita.estado} />}
      {cita.fuente === 'pdf' && (
        <span className="rounded-full bg-teal-500/15 px-2 py-0.5 text-[11px] font-medium text-teal-700 dark:text-teal-300">
          incluye TDR
        </span>
      )}
      <a
        href={cita.url}
        target="_blank"
        rel="noreferrer"
        className="shrink-0 rounded-lg bg-teal-500 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-teal-400"
      >
        Ver en SEACE
      </a>
      {onSimilares && contrato && (
        <button
          type="button"
          onClick={onSimilares}
          className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-teal-400 dark:border-slate-700 dark:text-slate-300"
        >
          Similares
        </button>
      )}
    </div>
  )
}

/** Un turno del chat: burbuja, citas, fuentes web y acciones de reintento. */
export function ChatMensaje({
  m,
  esperando,
  onSimilares,
  onReintentar,
  onBuscador,
}: {
  m: ChatMsg
  /** Último mensaje del bot sin texto todavía durante el streaming. */
  esperando: boolean
  onSimilares: (c: Contrato) => void
  onReintentar: (query: string) => void
  onBuscador: () => void
}) {
  return (
    <div className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[92%] sm:max-w-[85%] ${m.role === 'user' ? '' : 'w-full'}`}>
        {m.role === 'bot' && <p className="mb-1 text-[11px] font-medium text-teal-600 dark:text-teal-400">SEACE Bot</p>}
        <div className={`rounded-2xl px-3.5 py-2.5 ${
          m.role === 'user'
            ? 'rounded-br-sm bg-teal-500 text-white'
            : m.limit
              ? 'rounded-bl-sm border border-amber-500/40 bg-amber-500/10'
              : m.error
                ? 'rounded-bl-sm border border-red-500/30 bg-red-500/10'
                : 'rounded-bl-sm border border-[var(--border)] bg-[var(--bg-card)]'
        }`}
        >
          {m.role === 'bot' && m.stage && (
            <p className="mb-1.5 flex items-center gap-2 text-xs text-teal-600 dark:text-teal-400">
              <TypingDots />
              <span>{m.stage}</span>
            </p>
          )}
          {m.role === 'bot'
            ? (m.text
              ? <MarkdownRenderer content={m.text} className="text-sm" />
              : esperando
                ? <p className="text-xs text-slate-500">Esto puede tardar unos 10 segundos…</p>
                : null)
            : <p className="text-sm">{m.text}</p>}
        </div>
        {m.refs && m.refs.length > 0 && (
          <div className="mt-2 space-y-1.5">
            <p className="text-[11px] font-medium text-slate-500">Contratos citados</p>
            {m.refs.map(cita => {
              const contrato = m.contratos?.find(c => c.id === cita.id)
              return (
                <CitaFuente
                  key={cita.id}
                  cita={cita}
                  contrato={contrato}
                  onSimilares={contrato ? () => onSimilares(contrato) : undefined}
                />
              )
            })}
          </div>
        )}
        {m.webSources && m.webSources.length > 0 && (
          <div className="mt-2 space-y-1.5">
            <p className="text-[11px] font-medium text-slate-500">Fuentes web</p>
            {m.webSources.map(src => (
              <a
                key={src.uri}
                href={src.uri}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-teal-700 hover:border-teal-400 dark:border-slate-800 dark:bg-slate-900 dark:text-teal-400"
              >
                <span className="truncate">{src.title}</span>
                <span className="shrink-0 text-slate-400">↗</span>
              </a>
            ))}
          </div>
        )}
        {m.role === 'bot' && (m.error || m.limit) && (
          <div className="mt-2 flex gap-3">
            {m.query && (
              <button
                type="button"
                onClick={() => onReintentar(m.query!)}
                className="text-xs font-medium text-teal-600 dark:text-teal-400"
              >
                Reintentar
              </button>
            )}
            <button
              type="button"
              onClick={onBuscador}
              className="text-xs font-medium text-slate-500"
            >
              Ir al buscador
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

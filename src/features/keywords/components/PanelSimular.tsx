import type { SimularResultado } from '../api'

export function PanelSimular({
  r,
  umbral,
}: {
  r: SimularResultado
  umbral: boolean
}) {
  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900/50">
      <p>
        Etiquetaría hoy (sin clasificar):{' '}
        <span className="tabular-nums font-medium">{r.etiquetaria.toLocaleString('es-PE')}</span>
      </p>
      <p>
        Ya clasificados que cambiarían de categoría:{' '}
        <span className="tabular-nums font-medium">{r.cambios_categoria.toLocaleString('es-PE')}</span>
      </p>
      <p>
        Hits totales {r.universo.toLocaleString('es-PE')}
        {r.ratio_predictivo != null ? (
          <> · ratio {r.ratio_predictivo.toFixed(2)} (clasificados / total)</>
        ) : null}
      </p>
      {umbral && (
        <p className="text-amber-700 dark:text-amber-400">
          Más de 100 contratos sin clasificar. Confirmá explícitamente antes de guardar.
        </p>
      )}
      {r.ejemplos.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-400">
          {r.ejemplos.map((e) => (
            <li key={e.id}>
              <span className="font-mono">{e.id}</span>
              {' · '}
              {(e.titulo || '—').slice(0, 120)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

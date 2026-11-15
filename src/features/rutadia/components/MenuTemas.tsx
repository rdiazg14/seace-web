import { useState } from 'react'
import { etiquetaLinea, etiquetaSubtema, SIN_TEMA, type MenuTemas as Menu, type SeleccionTema } from '../temas'

const numero = (n: number) => n.toLocaleString('es-PE')

function Fila({
  activo,
  nivel,
  label,
  n,
  onClick,
}: {
  activo: boolean
  nivel: 'linea' | 'subtema'
  label: string
  n: number
  onClick: () => void
}) {
  const base = 'flex w-full items-baseline justify-between gap-2 rounded-md px-2 text-left transition-colors'
  const tamano = nivel === 'linea' ? 'py-1.5 text-[13px]' : 'py-1 text-xs'
  const tono = activo
    ? 'bg-teal-500/15 font-medium text-teal-700 dark:text-teal-300'
    : nivel === 'linea'
      ? 'text-[var(--text-primary)] hover:bg-slate-500/10'
      : 'text-[var(--text-secondary)] hover:bg-slate-500/10 hover:text-[var(--text-primary)]'
  return (
    <button type="button" onClick={onClick} aria-pressed={activo} className={`${base} ${tamano} ${tono}`}>
      <span className="min-w-0 break-words">{label}</span>
      <span className="shrink-0 text-[11px] tabular-nums opacity-70">{numero(n)}</span>
    </button>
  )
}

/**
 * Menú de temas: se arma con los procesos en curso. Columna fija en pantallas
 * anchas; en el teléfono se pliega y el botón dice qué tema está elegido.
 */
export default function MenuTemas({
  menu,
  seleccion,
  onSelect,
}: {
  menu: Menu
  seleccion: SeleccionTema
  onSelect: (seleccion: SeleccionTema) => void
}) {
  const [abierto, setAbierto] = useState(false)

  const elegido = seleccion.linea
    ? [etiquetaLinea(seleccion.linea), seleccion.subtema && etiquetaSubtema(seleccion.linea, seleccion.subtema)]
      .filter(Boolean).join(' › ')
    : null

  // En el teléfono el menú se pliega al elegir, para dejar la lista a la vista.
  const elegir = (nueva: SeleccionTema) => {
    setAbierto(false)
    onSelect(nueva)
  }
  // Un toque elige; otro sobre lo ya elegido sube un nivel.
  const elegirLinea = (linea: string) => {
    const soloLinea = seleccion.linea === linea && !seleccion.subtema
    elegir(soloLinea ? SIN_TEMA : { linea, subtema: null })
  }
  const elegirSubtema = (linea: string, subtema: string) => {
    const mismo = seleccion.linea === linea && seleccion.subtema === subtema
    elegir({ linea, subtema: mismo ? null : subtema })
  }

  return (
    <nav
      aria-label="Temas en curso"
      className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] lg:sticky lg:top-16 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto"
    >
      <button
        type="button"
        onClick={() => setAbierto(v => !v)}
        aria-expanded={abierto}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium text-[var(--text-secondary)] lg:hidden"
      >
        <span className="min-w-0">
          Temas
          {elegido
            ? <span className="ml-1.5 text-teal-700 dark:text-teal-300">· {elegido}</span>
            : <span className="ml-1.5 font-normal">· {numero(menu.lineas.length)} con procesos en curso</span>}
        </span>
        <span aria-hidden className="text-slate-400">{abierto ? '▴' : '▾'}</span>
      </button>

      <div className={`${abierto ? 'block' : 'hidden'} space-y-1 p-2 pt-0 lg:block lg:pt-2`}>
        <p className="hidden px-2 pb-1 text-[11px] text-[var(--text-secondary)] lg:block">
          Temas en curso
        </p>
        <Fila
          activo={!seleccion.linea}
          nivel="linea"
          label="Todos"
          n={menu.total}
          onClick={() => elegir(SIN_TEMA)}
        />
        {menu.lineas.length === 0 && (
          <p className="px-2 py-1 text-xs text-[var(--text-secondary)]">Sin procesos en curso.</p>
        )}
        <ul className="grid gap-x-3 gap-y-1 sm:grid-cols-2 lg:grid-cols-1">
          {menu.lineas.map(linea => (
            <li key={linea.id} className="min-w-0">
              <Fila
                activo={seleccion.linea === linea.id && !seleccion.subtema}
                nivel="linea"
                label={linea.label}
                n={linea.n}
                onClick={() => elegirLinea(linea.id)}
              />
              {linea.subtemas.length > 0 && (
                <ul className="ml-2 border-l border-[var(--border)] pl-1" aria-label={`Subtemas de ${linea.label}`}>
                  {linea.subtemas.map(subtema => (
                    <li key={subtema.id}>
                      <Fila
                        activo={seleccion.linea === linea.id && seleccion.subtema === subtema.id}
                        nivel="subtema"
                        label={subtema.label}
                        n={subtema.n}
                        onClick={() => elegirSubtema(linea.id, subtema.id)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}

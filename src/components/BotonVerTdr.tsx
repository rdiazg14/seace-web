import { useState } from 'react'
import { urlPdfTdr } from '../lib/pdfTdr'

const BTN_PRIMARIO =
  'rounded-lg bg-teal-500 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-teal-400'
const BTN_PRIMARIO_BUSY =
  'rounded-lg bg-teal-500/70 px-2.5 py-1 text-[11px] font-medium text-white pointer-events-none'

export function BotonVerTdr({
  contratoId,
  pdfArchivoId = null,
  pdfStoragePath,
}: {
  contratoId: number
  pdfArchivoId?: number | null
  pdfStoragePath: string | null | undefined
}) {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(false)

  if (!pdfStoragePath) return null

  async function abrir() {
    if (cargando) return
    setError(false)
    setCargando(true)
    try {
      const url = await urlPdfTdr(contratoId, pdfArchivoId ?? null, pdfStoragePath ?? null)
      if (!url) {
        setError(true)
        return
      }
      window.open(url, '_blank', 'noopener,noreferrer')
    } finally {
      setCargando(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void abrir()}
        disabled={cargando}
        className={cargando ? BTN_PRIMARIO_BUSY : BTN_PRIMARIO}
      >
        {cargando ? 'Abriendo…' : 'Ver TDR'}
      </button>
      {error && (
        <span className="text-[11px] text-slate-500">No se pudo abrir el TDR</span>
      )}
    </>
  )
}

export const BTN_SEACE_SECUNDARIO =
  'rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-teal-400 dark:border-slate-700 dark:text-slate-300'

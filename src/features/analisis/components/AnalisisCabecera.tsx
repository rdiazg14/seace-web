/** Navegación y cabecera de la ficha: número, título, entidad, estado, cierre y fecha del análisis. */

import { Link } from 'react-router-dom'
import { BotonVerTdr, BTN_SEACE_SECUNDARIO } from '../../../components/BotonVerTdr'
import { CatItIaPill, CierraPill, EstadoPill } from '../../../components/Pills'
import type { AnalisisResponse } from '../../../lib/analisis'
import { cierraEn, fmtFecha, fmtFechaHora, nroContrato, seaceUrl, tituloContrato } from '../../../lib/format'
import { esPorAbrir } from '../../rutadia/model'
import type { Contrato } from '../../../types'

export function AnalisisCabecera({
  ficha,
  data,
  idRuta,
}: {
  ficha: Contrato | null
  data: AnalisisResponse | null
  idRuta: string | undefined
}) {
  const cierre = cierraEn(ficha?.fecha_fin_cotizacion ?? null)
  const porAbrir = ficha ? esPorAbrir(ficha) : false
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to="/" className="text-xs font-medium text-teal-600 dark:text-teal-400">
          ← Diario
        </Link>
        {ficha && (
          <div className="flex flex-wrap items-center gap-2">
            <BotonVerTdr
              contratoId={ficha.id}
              pdfArchivoId={ficha.pdf_archivo_id ?? null}
              pdfStoragePath={ficha.pdf_storage_path}
            />
            <a
              href={seaceUrl(ficha.id)}
              target="_blank"
              rel="noreferrer"
              className={BTN_SEACE_SECUNDARIO}
            >
              Ver en SEACE
            </a>
          </div>
        )}
      </div>

      <header>
        <p className="text-[11px] uppercase tracking-wide text-slate-400">Análisis de contrato</p>
        <h1 className="mt-0.5 text-xl text-[var(--text-primary)] sm:text-2xl">
          {ficha ? nroContrato(ficha) : `Contrato ${idRuta}`}
        </h1>
        {ficha && (
          <>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{tituloContrato(ficha)}</p>
            <p className="text-xs text-slate-500">{ficha.entidad}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              <EstadoPill estado={ficha.estado} />
              <CatItIaPill categoria_it={ficha.categoria_it} relevancia_ia={ficha.relevancia_ia} />
              {porAbrir && ficha.fecha_ini_cotizacion && (
                <CierraPill label={`Abre ${fmtFechaHora(ficha.fecha_ini_cotizacion)}`} tone="abre" />
              )}
              {ficha.fecha_fin_cotizacion && ficha.estado === 'Vigente' && !porAbrir && (
                <CierraPill label={cierre.label} tone={cierre.tone} />
              )}
              {data?.urgente && (
                <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:text-red-400">
                  Urgente
                </span>
              )}
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              Pub. {fmtFecha(ficha.fecha_publica)}
              {ficha.fecha_fin_cotizacion && <> · Cierre {fmtFecha(ficha.fecha_fin_cotizacion)}</>}
              {ficha.tipo_cotizacion && <> · Tipo cotiz. {ficha.tipo_cotizacion}</>}
            </p>
            {data?.analizado_utc && (
              <p className="mt-1 text-[11px] text-slate-400">
                Analizado el {fmtFecha(data.analizado_utc)}
              </p>
            )}
          </>
        )}
      </header>
    </>
  )
}

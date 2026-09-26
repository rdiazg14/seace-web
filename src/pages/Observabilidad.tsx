import { Link } from 'react-router-dom'
import SeguimientoContrato from '../features/seguimiento/components/SeguimientoContrato'
import { useObservabilidad } from '../features/observabilidad/useObservabilidad'
import { SeccionTrigger } from '../features/observabilidad/components/SeccionTrigger'
import { SeccionConsumoIa } from '../features/observabilidad/components/SeccionConsumoIa'
import { SeccionCupos } from '../features/observabilidad/components/SeccionCupos'
import { SeccionSinIntento } from '../features/observabilidad/components/SeccionSinIntento'
import { SeccionCubso } from '../features/observabilidad/components/SeccionCubso'

export default function Observabilidad() {
  const o = useObservabilidad()

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

      <SeccionTrigger
        stats={o.stats}
        statsErr={o.statsErr}
        statsLoading={o.statsLoading}
        loadStats={o.loadStats}
        trigger={{
          lastErr: o.lastErr,
          lastOk: o.lastOk,
          tokenExpira: o.tokenExpira,
          diasToken: o.diasToken,
          triggerStale: o.triggerStale,
          triggerSinOk: o.triggerSinOk,
          tokenCls: o.tokenCls,
        }}
      />

      <SeccionConsumoIa
        uso={o.uso}
        usoErr={o.usoErr}
        usoLoading={o.usoLoading}
        usoDesde={o.usoDesde}
        usoHasta={o.usoHasta}
        modeloFiltro={o.modeloFiltro}
        compFiltro={o.compFiltro}
        modelos={o.modelos}
        setUsoDesde={o.setUsoDesde}
        setUsoHasta={o.setUsoHasta}
        setModeloFiltro={o.setModeloFiltro}
        setCompFiltro={o.setCompFiltro}
        loadUso={o.loadUso}
        compBars={o.compBars}
        donut={o.donut}
        axis={o.axis}
        grid={o.grid}
        tipBg={o.tipBg}
        tipFg={o.tipFg}
      />

      <SeccionCupos
        stats={o.stats}
        statsErr={o.statsErr}
        statsLoading={o.statsLoading}
        loadStats={o.loadStats}
        kvRows={o.kvRows}
      />

      <SeccionSinIntento
        sinIntento={o.sinIntento}
        sinIntentoErr={o.sinIntentoErr}
        sinIntentoLoading={o.sinIntentoLoading}
        sinPage={o.sinPage}
        sinSoloTi={o.sinSoloTi}
        setSinPage={o.setSinPage}
        setSinSoloTi={o.setSinSoloTi}
        loadSinIntento={o.loadSinIntento}
        totalPaginas={o.totalPaginas}
      />

      <SeccionCubso
        cubso={o.cubso}
        cubsoErr={o.cubsoErr}
        cubsoLoading={o.cubsoLoading}
        loadCubso={o.loadCubso}
      />

      {/* ── Seguimiento por contrato (pipeline de IA) ─────────────────── */}
      <SeguimientoContrato />
    </div>
  )
}

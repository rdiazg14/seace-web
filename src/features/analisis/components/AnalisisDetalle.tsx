/** Cuerpo del análisis: infografía, veredicto, vías, encaje, economía, timeline, condiciones y riesgos. */

import {
  AlternativasBlock,
  ComponentesTabs,
  ContradiccionesBlock,
  EconomiaPorComponente,
  InfografiaRatio,
  descalificadorDe,
} from '../../../components/AnalisisV2'
import { TimelineCard } from '../../../components/TimelineFishbone'
import {
  labelCalifica,
  labelModalidad,
  labelRubro,
  soles,
  type AnalisisResponse,
} from '../../../lib/analisis'
import { CondCard, EntregablesTable, RequisitosBlock, RiesgosBlock, VeredictoBanner } from './Secciones'

export function AnalisisDetalle({ data, contratoId }: { data: AnalisisResponse; contratoId: number }) {
  const a = data.analisis
  return (
    <>
      {a.viabilidad?.ratio_alcance && (
        <InfografiaRatio
          ratio={a.viabilidad.ratio_alcance}
          codigo={a.veredicto.codigo}
          encaje={a.encaje}
          duracion={a.timeline?.duracion_total_texto}
          descalificador={descalificadorDe(a)}
        />
      )}

      <p className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[11px] text-[var(--text-secondary)]">
        Guía para decidir, no una cotización. Techo 8 UIT = {soles(data.techo_soles)}.
        TDR: {data.tdr_fuente === 'ficha' ? 'sin texto extraído (solo ficha)' : `${data.tdr_fuente} · ${data.tdr_chars.toLocaleString('es-PE')} chars`}.
        El número final lo pone ENERTRONIC.
      </p>

      <VeredictoBanner
        codigo={a.veredicto.codigo}
        urgente={data.urgente}
        razon={a.veredicto.razonamiento}
        aviso={a.veredicto.aviso_humano}
      />

      {(a.alternativas?.length ?? 0) > 0 && (
        <AlternativasBlock key={contratoId} items={a.alternativas!} />
      )}

      <section>
        <h2 className="mb-2 text-sm font-medium text-[var(--text-primary)]">Qué se contrata</h2>
        <p className="text-sm text-[var(--text-secondary)]">{a.resumen}</p>
      </section>

      {(a.componentes_servicio?.length ?? 0) > 1 && (
        <ComponentesTabs items={a.componentes_servicio!} />
      )}

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3">
          <p className="text-[11px] text-[var(--text-secondary)]">Encaje</p>
          <p className="mt-1 text-sm font-medium">
            {labelRubro(a.encaje.rubro)} · {labelCalifica(a.encaje.califica)}
          </p>
          <p className="mt-1 text-[11px] text-[var(--text-secondary)]">Perfil pedido: {a.encaje.perfil_pedido || 'no consta'}</p>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">{a.encaje.razon}</p>
          {a.requisitos_proveedor && (
            <RequisitosBlock r={a.requisitos_proveedor} />
          )}
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3">
          <p className="text-[11px] text-[var(--text-secondary)]">Economía (estimaciones)</p>
          <p className="mt-1 text-sm">Valor est. {soles(a.economia.valor_estimado_soles)}</p>
          <p className="text-sm">Costo est. {soles(a.economia.costo_estimado_soles)}</p>
          <p className="text-sm font-medium">Margen est. {soles(a.economia.margen_soles)}</p>
          <p className="mt-2 text-[11px] text-[var(--text-secondary)]">{a.economia.pistas_valor}</p>
          {(a.viabilidad?.cotizacion_por_componente?.length ?? 0) > 0 && (
            <EconomiaPorComponente
              componentes={a.viabilidad!.cotizacion_por_componente!}
              techo={a.viabilidad?.ratio_alcance?.techo_contrato ?? data.techo_soles}
              lectura={a.viabilidad?.ratio_alcance?.lectura}
            />
          )}
        </div>
      </section>

      {(a.timeline?.hitos?.length ?? 0) > 0 && (
        <TimelineCard timeline={a.timeline!} />
      )}

      <section>
        <h2 className="mb-2 text-sm font-medium text-[var(--text-primary)]">Condiciones (del TDR)</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <CondCard
            title="Modalidad"
            value={labelModalidad(a.condiciones.modalidad)}
            detail={a.condiciones.modalidad_detalle}
            tono={a.condiciones.tono_modalidad}
          />
          <CondCard
            title="Pago"
            value={a.condiciones.armadas != null ? `${a.condiciones.armadas} armada(s)` : 'Ver detalle'}
            detail={a.condiciones.pago}
            tono={a.condiciones.tono_pago}
          />
          <CondCard
            title="Plazo"
            value={a.condiciones.plazo || 'No consta'}
            detail={a.condiciones.plazo}
            tono={a.condiciones.tono_plazo}
          />
          <CondCard
            title="Penalidades"
            value={a.condiciones.penalidades ? 'Ver detalle' : 'No consta'}
            detail={a.condiciones.penalidades}
            tono={a.condiciones.tono_penalidad}
          />
        </div>
      </section>

      {(a.estructura_contractual?.entregables?.length ?? 0) > 0 && (
        <EntregablesTable items={a.estructura_contractual!.entregables!} />
      )}

      {a.riesgos_contractuales && (
        <RiesgosBlock r={a.riesgos_contractuales} />
      )}

      {(a.viabilidad?.contradicciones_tdr?.length ?? 0) > 0 && (
        <ContradiccionesBlock items={a.viabilidad!.contradicciones_tdr!} />
      )}

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3">
          <p className="text-sm font-medium">Supuestos (explícitos)</p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-[12px] text-[var(--text-secondary)]">
            {(a.economia.supuestos || []).map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="text-sm font-medium">Lo que la IA no sabe</p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-[12px] text-[var(--text-secondary)]">
            {(a.economia.lo_que_no_sabe || []).map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      </section>

      {(a.optimizacion || []).filter(s => String(s).trim()).length > 0 && (
        <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3">
          <p className="text-sm font-medium">Cómo mejorar el margen</p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-[var(--text-secondary)]">
            {a.optimizacion.filter(s => String(s).trim()).map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </section>
      )}
    </>
  )
}

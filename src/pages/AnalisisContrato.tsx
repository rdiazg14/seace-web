import { useParams } from 'react-router-dom'
import { nroContrato, tituloContrato } from '../lib/format'
import { AsistentePanel } from '../features/analisis/asistente/components/AsistentePanel'
import { AnalisisCabecera } from '../features/analisis/components/AnalisisCabecera'
import { AnalisisDetalle } from '../features/analisis/components/AnalisisDetalle'
import { AnalisisEstados } from '../features/analisis/components/AnalisisEstados'
import { useAnalisisContrato } from '../features/analisis/useAnalisisContrato'
import { usePanelAsistente } from '../features/analisis/usePanelAsistente'

export default function AnalisisContrato() {
  const { id } = useParams()
  const contratoId = Number(id)
  const { ficha, data, loading, error, error502, sinTdr, sinAnalisis, analizarAhora } = useAnalisisContrato(contratoId)
  const panel = usePanelAsistente(contratoId)

  const a = data?.analisis
  const nro = ficha ? nroContrato(ficha) : (data?.nro || `Contrato ${id}`)

  return (
    <div
      className={panel.panelResizing ? '' : 'transition-[margin-right] duration-[250ms] ease-out'}
      style={{ marginRight: panel.chatOpen && panel.desktop ? panel.panelWidth : 0 }}
    >
      <div className="mx-auto max-w-6xl space-y-5 px-3 py-5 sm:px-4 text-[var(--text-primary)]">
        <AnalisisCabecera ficha={ficha} data={data} idRuta={id} />
        <AnalisisEstados
          sinTdr={sinTdr}
          sinAnalisis={sinAnalisis}
          error502={error502}
          error={error}
          loading={loading}
          onAnalizar={() => void analizarAhora()}
        />
        {a && data && <AnalisisDetalle data={data} contratoId={contratoId} />}
      </div>
      {a && Number.isFinite(contratoId) && contratoId > 0 && (
        <AsistentePanel
          key={contratoId}
          contratoId={contratoId}
          nro={nro}
          contratoTitulo={ficha ? tituloContrato(ficha) : ''}
          categoriaIt={ficha?.categoria_it ?? undefined}
          chipsIniciales={a.chips_sugeridos ?? undefined}
          open={panel.chatOpen}
          desktop={panel.desktop}
          panelWidth={panel.panelWidth}
          onResizeMouseDown={panel.onResizeMouseDown}
          onOpen={panel.abrir}
          onClose={panel.cerrar}
        />
      )}
    </div>
  )
}

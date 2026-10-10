import { tokensSesion, type SesionChat } from '../lib/chatSesiones'

/** Tokens de una conversación en las listas: cifra del servidor, o estimación del navegador rotulada (SEC-006). */
export function TokensSesion({ s }: { s: SesionChat }) {
  const { tokens, estimado } = tokensSesion(s)
  const cifra = `${tokens.toLocaleString('es-PE')} tokens`
  if (!estimado) return <span title="Tokens registrados por el servidor">{cifra}</span>
  return (
    <span title="Estimado guardado por el navegador: alguna respuesta no tiene registro del servidor">
      ≈ {cifra}<span className="sr-only"> (estimado)</span>
    </span>
  )
}

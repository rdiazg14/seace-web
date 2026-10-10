/**
 * Alerta de presupuesto por correo (GW-001). La invoca la tarea programada de
 * la base (pg_cron + pg_net) con el JWT de service_role. Lee el gasto del día,
 * decide el nivel, reclama el envío de forma atómica (un correo por nivel y
 * día) y lo manda por SMTP. Nunca devuelve secretos ni el detalle de un error.
 */
import { diaUtc, evaluar, leerConfig, redactar, rolDeJwt, type Correo } from './nucleo.ts'

export interface Puertos {
  /** Fila única de configuración, o null si no existe. */
  config(): Promise<unknown>
  /** Centavos acumulados del día UTC; lanza si no se puede leer. */
  gastoCents(dia: string): Promise<number>
  /** true solo si este llamado obtuvo el envío pendiente de (día, nivel). */
  reclamar(dia: string, nivel: string): Promise<boolean>
  marcar(dia: string, nivel: string, ok: boolean, error: string | null): Promise<void>
  /** null = sin SMTP configurado. */
  correo(): ((destinatario: string, c: Correo) => Promise<void>) | null
  ahora(): Date
  panelUrl: string
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

export function crearHandler(p: Puertos) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
    if (rolDeJwt(req.headers.get('Authorization')) !== 'service_role') return json({ error: 'forbidden' }, 403)
    try {
      const cfg = leerConfig(await p.config())
      if (!cfg) return json({ resultado: 'config_invalida' })
      if (!cfg.activo) return json({ resultado: 'inactiva' })
      if (!cfg.destinatario) return json({ resultado: 'sin_destinatario' })

      const dia = diaUtc(p.ahora())
      const e = evaluar((await p.gastoCents(dia)) / 100, cfg)
      if (e.nivel === 'ok') return json({ resultado: 'sin_alerta', nivel: e.nivel, pct: e.pct })

      const enviar = p.correo()
      if (!enviar) return json({ resultado: 'smtp_no_configurado', nivel: e.nivel, pct: e.pct })
      // El reclamo va después de comprobar que hay con qué enviar: sin SMTP no se
      // consumen intentos del día.
      if (!(await p.reclamar(dia, e.nivel))) return json({ resultado: 'ya_enviada', nivel: e.nivel, pct: e.pct })

      try {
        await enviar(cfg.destinatario, redactar(e, dia, p.panelUrl))
      } catch {
        await p.marcar(dia, e.nivel, false, 'fallo_envio')
        return json({ resultado: 'fallo_envio', nivel: e.nivel, pct: e.pct })
      }
      await p.marcar(dia, e.nivel, true, null)
      return json({ resultado: 'enviada', nivel: e.nivel, pct: e.pct })
    } catch {
      return json({ error: 'internal_error' }, 500)
    }
  }
}

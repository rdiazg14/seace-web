/**
 * Reglas puras de la alerta de presupuesto de IA por correo (GW-001).
 * Mismos niveles que el aviso del panel: el gasto es la estimación acumulada
 * del día UTC, no la facturación del proveedor.
 */

export type Nivel = 'ok' | 'aviso' | 'critico' | 'agotado'

export interface Config {
  activo: boolean
  limite_usd: number
  aviso_pct: number
  critico_pct: number
  destinatario: string | null
}

export interface Evaluacion {
  nivel: Nivel
  gasto_usd: number
  limite_usd: number
  pct: number
}

/** Día UTC `YYYY-MM-DD`, la misma ventana que usa el presupuesto del proxy. */
export function diaUtc(ahora: Date): string {
  return ahora.toISOString().slice(0, 10)
}

/** Valida la fila de configuración; null si no permite evaluar (no se envía nada). */
export function leerConfig(raw: unknown): Config | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN)
  const limite = num(o.limite_usd)
  const aviso = num(o.aviso_pct)
  const critico = num(o.critico_pct)
  if (!Number.isFinite(limite) || limite <= 0) return null
  if (!Number.isFinite(aviso) || !Number.isFinite(critico) || aviso <= 0 || critico >= 100 || aviso >= critico) return null
  const dest = typeof o.destinatario === 'string' ? o.destinatario.trim() : ''
  return {
    activo: o.activo === true,
    limite_usd: limite,
    aviso_pct: aviso,
    critico_pct: critico,
    destinatario: /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(dest) ? dest : null,
  }
}

export function evaluar(gastoUsd: number, cfg: Config): Evaluacion {
  // Redondeo a 1e-9: 1.2/1.5 da 0.7999999999999999 y no debe quedar bajo el 80 %.
  const razon = Math.round((gastoUsd / cfg.limite_usd) * 1e9) / 1e9
  const nivel: Nivel = razon >= 1
    ? 'agotado'
    : razon >= cfg.critico_pct / 100
      ? 'critico'
      : razon >= cfg.aviso_pct / 100
        ? 'aviso'
        : 'ok'
  return { nivel, gasto_usd: gastoUsd, limite_usd: cfg.limite_usd, pct: Math.round(razon * 1000) / 10 }
}

const usd = (n: number) => `USD ${n.toFixed(n < 1 ? 4 : 2)}`

const TITULO: Record<Exclude<Nivel, 'ok'>, string> = {
  aviso: 'Aviso: el gasto de IA superó el primer umbral del día',
  critico: 'Crítico: el presupuesto de IA del día está por agotarse',
  agotado: 'Presupuesto de IA del día agotado',
}

const CONSECUENCIA: Record<Exclude<Nivel, 'ok'>, string> = {
  aviso: 'No hay ningún bloqueo todavía.',
  critico: 'Al llegar al límite, el chat, el análisis y la cotización se bloquean hasta el cambio de día UTC.',
  agotado: 'El chat, el análisis y la cotización están bloqueados hasta el cambio de día UTC.',
}

export interface Correo {
  asunto: string
  texto: string
  html: string
}

/** Correo en texto y HTML sin recursos externos; solo cifras agregadas. */
export function redactar(e: Evaluacion, dia: string, panelUrl: string): Correo {
  if (e.nivel === 'ok') throw new Error('nivel ok no genera correo')
  const titulo = TITULO[e.nivel]
  const cifra = `Gasto estimado del ${dia} (UTC): ${usd(e.gasto_usd)} de ${usd(e.limite_usd)} (${e.pct} %).`
  const nota = 'Es la estimación acumulada por el proxy, no la facturación del proveedor. Se envía un solo correo por nivel y por día.'
  const texto = [titulo, '', cifra, CONSECUENCIA[e.nivel], '', `Detalle: ${panelUrl}`, '', nota].join('\n')
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1e293b;max-width:520px">`
    + `<p style="font-size:17px;font-weight:bold;color:#0f766e;margin:0 0 12px">SEACE Monitor</p>`
    + `<p style="font-weight:bold">${titulo}</p><p>${cifra}</p><p>${CONSECUENCIA[e.nivel]}</p>`
    + `<p><a href="${panelUrl}">Abrir Observabilidad</a></p>`
    + `<p style="font-size:13px;color:#64748b">${nota}</p></div>`
  return { asunto: `[SEACE Monitor] ${titulo} (${e.pct} %)`, texto, html }
}

/** El rol viene del JWT que la plataforma ya verificó (verify_jwt): solo service_role dispara la alerta. */
export function rolDeJwt(authorization: string | null): string | null {
  const token = (authorization || '').replace(/^Bearer\s+/i, '').trim()
  const partes = token.split('.')
  if (partes.length !== 3) return null
  try {
    const b64 = partes[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '='))) as { role?: unknown }
    return typeof payload.role === 'string' ? payload.role : null
  } catch {
    return null
  }
}

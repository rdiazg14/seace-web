/** Alerta de presupuesto por correo (GW-001): reglas y handler con puertos simulados. */
import { describe, expect, it, vi } from 'vitest'
import { crearHandler, type Puertos } from './handler.ts'
import { diaUtc, evaluar, leerConfig, redactar, rolDeJwt, type Config } from './nucleo.ts'

const CFG: Config = { activo: true, limite_usd: 1.5, aviso_pct: 50, critico_pct: 80, destinatario: 'dueno@example.test' }
const jwt = (role: string) => `Bearer h.${btoa(JSON.stringify({ role })).replace(/=+$/, '')}.s`

function setup(over: Partial<Puertos> & { cents?: number; cfg?: unknown; smtp?: boolean } = {}) {
  const enviar = vi.fn(async (_destinatario: string, _correo: unknown) => undefined)
  const p: Puertos = {
    config: vi.fn(async () => (over.cfg === undefined ? { ...CFG } : over.cfg)),
    gastoCents: vi.fn(async () => over.cents ?? 80),
    reclamar: vi.fn(async () => true),
    marcar: vi.fn(async () => undefined),
    correo: () => (over.smtp === false ? null : enviar),
    ahora: () => new Date('2026-10-10T23:30:00Z'),
    panelUrl: 'https://app.example.test/observabilidad',
    ...over,
  }
  const handler = crearHandler(p)
  const llamar = async (auth: string | null = jwt('service_role'), method = 'POST') => {
    const res = await handler(new Request('https://x.test/functions/v1/alerta-presupuesto', { method, headers: auth ? { Authorization: auth } : {} }))
    return { status: res.status, body: await res.json() as Record<string, unknown> }
  }
  return { p, enviar, llamar }
}

describe('reglas', () => {
  it('niveles en los bordes exactos, incluido el de coma flotante del 80 %', () => {
    expect(evaluar(0.7499, CFG).nivel).toBe('ok')
    expect(evaluar(0.75, CFG).nivel).toBe('aviso')
    expect(evaluar(1.2, CFG).nivel).toBe('critico')
    expect(evaluar(1.5, CFG).nivel).toBe('agotado')
    expect(evaluar(4, CFG).pct).toBe(266.7)
  })

  it('la configuración inválida no permite evaluar', () => {
    expect(leerConfig(null)).toBeNull()
    expect(leerConfig({ ...CFG, limite_usd: 0 })).toBeNull()
    expect(leerConfig({ ...CFG, aviso_pct: 90, critico_pct: 80 })).toBeNull()
    expect(leerConfig({ ...CFG, limite_usd: '1.50' })?.limite_usd).toBe(1.5)
    expect(leerConfig({ ...CFG, destinatario: 'a@b.c, otro@x.y' })?.destinatario).toBeNull()
    expect(leerConfig({ ...CFG, activo: 'true' })?.activo).toBe(false)
  })

  it('el correo dice nivel, cifras y consecuencia, sin recursos externos', () => {
    const c = redactar(evaluar(1.3, CFG), '2026-10-10', 'https://app.example.test/observabilidad')
    expect(c.asunto).toBe('[SEACE Monitor] Crítico: el presupuesto de IA del día está por agotarse (86.7 %)')
    expect(c.texto).toContain('Gasto estimado del 2026-10-10 (UTC): USD 1.30 de USD 1.50 (86.7 %).')
    expect(c.texto).toContain('se bloquean hasta el cambio de día UTC')
    expect(c.html).not.toMatch(/<img|<script|src=/)
    expect(() => redactar(evaluar(0.1, CFG), '2026-10-10', 'x')).toThrow()
  })

  it('día UTC y rol del JWT', () => {
    expect(diaUtc(new Date('2026-10-10T23:59:59-05:00'))).toBe('2026-10-11')
    expect(rolDeJwt(jwt('service_role'))).toBe('service_role')
    expect(rolDeJwt(jwt('authenticated'))).toBe('authenticated')
    expect(rolDeJwt('Bearer no-es-jwt')).toBeNull()
    expect(rolDeJwt(null)).toBeNull()
  })
})

describe('handler', () => {
  it('solo service_role por POST; lo demás se rechaza antes de tocar la base', async () => {
    const { p, llamar } = setup()
    expect((await llamar(jwt('authenticated'))).status).toBe(403)
    expect((await llamar(jwt('anon'))).status).toBe(403)
    expect((await llamar(null)).status).toBe(403)
    expect((await llamar(jwt('service_role'), 'GET')).status).toBe(405)
    expect(p.config).not.toHaveBeenCalled()
  })

  it('bajo el primer umbral no reclama ni envía', async () => {
    const { p, enviar, llamar } = setup({ cents: 10 })
    expect((await llamar()).body).toMatchObject({ resultado: 'sin_alerta', nivel: 'ok' })
    expect(p.reclamar).not.toHaveBeenCalled()
    expect(enviar).not.toHaveBeenCalled()
  })

  it('al cruzar un umbral envía una vez y lo marca; el siguiente tick no repite', async () => {
    const reclamar = vi.fn().mockResolvedValueOnce(true).mockResolvedValue(false)
    const { p, enviar, llamar } = setup({ cents: 80, reclamar })
    expect((await llamar()).body).toMatchObject({ resultado: 'enviada', nivel: 'aviso', pct: 53.3 })
    expect(enviar).toHaveBeenCalledTimes(1)
    expect(enviar.mock.calls[0][0]).toBe('dueno@example.test')
    expect(p.marcar).toHaveBeenCalledWith('2026-10-10', 'aviso', true, null)
    expect((await llamar()).body).toMatchObject({ resultado: 'ya_enviada' })
    expect(enviar).toHaveBeenCalledTimes(1)
  })

  it('cada nivel se reclama por separado y con el día UTC vigente', async () => {
    const { p, llamar } = setup({ cents: 150 })
    await llamar()
    expect(p.reclamar).toHaveBeenCalledWith('2026-10-10', 'agotado')
    expect(p.gastoCents).toHaveBeenCalledWith('2026-10-10')
  })

  it('fallo del SMTP: queda marcado como fallo, sin detalle del error en la respuesta', async () => {
    const { p, llamar } = setup({ cents: 130 })
    ;(p.correo() as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('535 clave-secreta rechazada'))
    const r = await llamar()
    expect(r.body).toMatchObject({ resultado: 'fallo_envio', nivel: 'critico' })
    expect(JSON.stringify(r.body)).not.toContain('clave-secreta')
    expect(p.marcar).toHaveBeenCalledWith('2026-10-10', 'critico', false, 'fallo_envio')
  })

  it('sin SMTP configurado no consume intentos del día', async () => {
    const { p, llamar } = setup({ cents: 130, smtp: false })
    expect((await llamar()).body).toMatchObject({ resultado: 'smtp_no_configurado' })
    expect(p.reclamar).not.toHaveBeenCalled()
  })

  it('inactiva, sin destinatario o con configuración inválida: no lee el gasto', async () => {
    for (const [cfg, resultado] of [
      [{ ...CFG, activo: false }, 'inactiva'],
      [{ ...CFG, destinatario: null }, 'sin_destinatario'],
      [{ ...CFG, limite_usd: -1 }, 'config_invalida'],
      [null, 'config_invalida'],
    ] as const) {
      const { p, llamar } = setup({ cfg })
      expect((await llamar()).body).toEqual({ resultado })
      expect(p.gastoCents).not.toHaveBeenCalled()
    }
  })

  it('un error de la base responde 500 genérico', async () => {
    const { enviar, llamar } = setup({ gastoCents: vi.fn(async () => { throw new Error('postgres: detalle interno') }) })
    const r = await llamar()
    expect(r.status).toBe(500)
    expect(r.body).toEqual({ error: 'internal_error' })
    expect(enviar).not.toHaveBeenCalled()
  })
})

describe('correo de prueba', () => {
  const pedir = async (s: ReturnType<typeof setup>, cuerpo: unknown, auth = jwt('service_role')) => {
    const res = await crearHandler(s.p)(new Request('https://x.test/functions/v1/alerta-presupuesto', {
      method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
    }))
    return { status: res.status, body: await res.json() as Record<string, unknown> }
  }

  it('envía un correo rotulado como prueba sin reclamar ni marcar ningún nivel', async () => {
    const s = setup({ cents: 10 })
    const r = await pedir(s, { prueba: true })
    expect(r.body).toMatchObject({ resultado: 'prueba_enviada', nivel: 'ok' })
    expect(s.enviar).toHaveBeenCalledTimes(1)
    const correo = s.enviar.mock.calls[0][1] as { asunto: string; texto: string }
    expect(correo.asunto).toBe('[SEACE Monitor] Correo de prueba de la alerta de presupuesto')
    expect(correo.texto).toContain('no cuenta como alerta')
    expect(s.p.reclamar).not.toHaveBeenCalled()
    expect(s.p.marcar).not.toHaveBeenCalled()
  })

  it('exige service_role igual que el disparo normal', async () => {
    const s = setup()
    expect((await pedir(s, { prueba: true }, jwt('authenticated'))).status).toBe(403)
    expect(s.enviar).not.toHaveBeenCalled()
  })

  it('solo prueba:true exacto la activa; otro cuerpo sigue el flujo normal', async () => {
    const s = setup({ cents: 10 })
    expect((await pedir(s, { prueba: 'true' })).body).toMatchObject({ resultado: 'sin_alerta' })
    expect((await pedir(s, {})).body).toMatchObject({ resultado: 'sin_alerta' })
    expect(s.enviar).not.toHaveBeenCalled()
  })

  it('sin SMTP o con fallo de envío lo dice sin detalle', async () => {
    expect((await pedir(setup({ smtp: false }), { prueba: true })).body).toEqual({ resultado: 'smtp_no_configurado' })
    const s = setup()
    s.enviar.mockRejectedValueOnce(new Error('535 credenciales'))
    const r = await pedir(s, { prueba: true })
    expect(r.body).toEqual({ resultado: 'fallo_envio', prueba: true })
  })
})

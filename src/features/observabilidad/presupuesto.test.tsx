// @vitest-environment jsdom
/** Alerta de presupuesto de IA (GW-001): traducción del bloque del proxy y su
 *  presentación en el panel, incluido un proxy antiguo o una respuesta malformada. */
import '../../test/dom'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { AvisoPresupuesto } from './components/AvisoPresupuesto'
import { avisoPresupuesto, type AdminStats } from './model'

afterEach(cleanup)

const stats = (presupuesto: unknown): AdminStats => ({ day: '2026-10-10', kv: {} as AdminStats['kv'], presupuesto })
const bloque = (over: Record<string, unknown>) => ({
  nivel: 'ok', gasto_usd: 0.12, limite_usd: 1.5, pct: 8, umbrales: { aviso: 50, critico: 80 }, ...over,
})

describe('avisoPresupuesto', () => {
  it('cada nivel tiene título propio y tono acorde', () => {
    const tonos = Object.fromEntries(
      ['sin_limite', 'ok', 'aviso', 'critico', 'agotado', 'no_verificable'].map(n => [n, avisoPresupuesto(stats(bloque({ nivel: n })))!.tono]),
    )
    expect(tonos).toEqual({ sin_limite: 'neutro', ok: 'ok', aviso: 'warn', critico: 'error', agotado: 'error', no_verificable: 'error' })
    const titulos = new Set(['ok', 'aviso', 'critico', 'agotado', 'no_verificable', 'sin_limite'].map(n => avisoPresupuesto(stats(bloque({ nivel: n })))!.titulo))
    expect(titulos.size).toBe(6)
  })

  it('muestra gasto, límite y porcentaje como estimación del día UTC', () => {
    expect(avisoPresupuesto(stats(bloque({ nivel: 'aviso', gasto_usd: 0.75, pct: 50 })))!.detalle)
      .toBe('Gasto estimado hoy (UTC): $0.7500 de $1.50 (50 %).')
  })

  it('agotado y crítico explican la consecuencia', () => {
    expect(avisoPresupuesto(stats(bloque({ nivel: 'agotado', gasto_usd: 1.6, pct: 106.7 })))!.detalle).toMatch(/bloqueadas hasta el cambio de día UTC/)
    expect(avisoPresupuesto(stats(bloque({ nivel: 'critico', gasto_usd: 1.3, pct: 86.7 })))!.detalle).toMatch(/se bloquean hasta mañana/)
  })

  it('gasto ilegible no inventa cifras', () => {
    const a = avisoPresupuesto(stats(bloque({ nivel: 'no_verificable', gasto_usd: null, limite_usd: null, pct: null })))!
    expect(a.detalle).toMatch(/^No se pudo leer el gasto del día\./)
    expect(a.detalle).not.toMatch(/\$/)
  })

  it('proxy antiguo sin el bloque o respuesta malformada: sin aviso', () => {
    expect(avisoPresupuesto(null)).toBeNull()
    expect(avisoPresupuesto(stats(undefined))).toBeNull()
    expect(avisoPresupuesto(stats('texto'))).toBeNull()
    expect(avisoPresupuesto(stats({ nivel: 'inventado', gasto_usd: 1 }))).toBeNull()
  })

  it('valores no numéricos o negativos se tratan como desconocidos', () => {
    const a = avisoPresupuesto(stats(bloque({ nivel: 'aviso', gasto_usd: '1', limite_usd: -5, pct: 'x' })))!
    expect(a.detalle).toBe('No se pudo leer el gasto del día.')
  })
})

describe('AvisoPresupuesto', () => {
  it('aviso, crítico y agotado se anuncian como alerta; ok y sin límite como estado', () => {
    const { rerender } = render(<AvisoPresupuesto aviso={avisoPresupuesto(stats(bloque({ nivel: 'agotado' })))} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Presupuesto de IA del día agotado')
    rerender(<AvisoPresupuesto aviso={avisoPresupuesto(stats(bloque({ nivel: 'ok' })))} />)
    expect(screen.getByRole('status')).toHaveTextContent('Presupuesto de IA del día en rango')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('sin aviso no renderiza nada', () => {
    const { container } = render(<AvisoPresupuesto aviso={null} />)
    expect(container).toBeEmptyDOMElement()
  })
})

import { describe, expect, it } from 'vitest'
import { modelosElegibles, resumenCambio } from './model'
import type { Endpoint, Modelo } from './api'

const modelo = (id: string, modelo = `m-${id}`): Modelo => ({
  id, proveedor_id: 'qwen', modelo, tipo: 'generacion', dimensiones: null,
  espacio_vectorial: null, contexto_max: null, salida_max: null, timeout_ms: null,
  capacidades: null, params: null, precio: null, activo: true, notas: null,
})

const ep = (habilitados: string[] | null, modelo_id: string | null = null): Endpoint => ({
  endpoint: 'chat', modelo_id, habilitados, hereda: null, config: null, activo: true, updated_at: null,
})

describe('modelosElegibles', () => {
  const todos = [modelo('a'), modelo('b'), modelo('c')]

  it('devuelve solo los modelos en habilitados', () => {
    expect(modelosElegibles(ep(['a', 'c']), todos).map(m => m.id)).toEqual(['a', 'c'])
  })

  it('habilitados vacío o null → sin opciones (no ofrece todo el catálogo)', () => {
    expect(modelosElegibles(ep([]), todos)).toEqual([])
    expect(modelosElegibles(ep(null), todos)).toEqual([])
  })

  it('ids habilitados que no existen en el catálogo se ignoran', () => {
    expect(modelosElegibles(ep(['a', 'zz']), todos).map(m => m.id)).toEqual(['a'])
  })
})

describe('resumenCambio', () => {
  const base = { id: 1, user_id: 'u', accion: 'editar', entidad: 'ia_endpoints', created_at: 'x' }

  it('resume el después cuando existe', () => {
    const out = resumenCambio({ ...base, antes: null, despues: { activo: true, modelo_id: 'abc', id: 9, updated_at: 't' } })
    expect(out).toContain('activo: true')
    expect(out).toContain('modelo_id: "abc"')
    expect(out).not.toContain('updated_at')
  })

  it('cae en antes si despues está vacío', () => {
    const out = resumenCambio({ ...base, antes: { activo: false }, despues: {} })
    expect(out).toBe('activo: false')
  })

  it('sin datos → —', () => {
    expect(resumenCambio({ ...base, antes: null, despues: null })).toBe('—')
  })
})

import { describe, expect, it } from 'vitest'
import { KEYWORD_CATS } from '../../lib/cats'
import {
  catsSugeridas,
  filtrarKeywords,
  senalOriginal,
  siguienteOrden,
  terminoDe,
  type CandidataRow,
  type ColaRow,
  type KeywordRow,
} from './model'

function cola(parcial: Partial<ColaRow>): ColaRow {
  return {
    id: 1,
    contrato_id: 100,
    categoria_p1: null,
    categoria_p2: null,
    origen: null,
    votos: null,
    estado: 'pendiente',
    nota: null,
    titulo: null,
    ...parcial,
  }
}

function cand(parcial: Partial<CandidataRow>): CandidataRow {
  return {
    id: 1,
    senal: 'senal-x',
    categoria_propuesta: 'ia',
    veces_vista: 3,
    estado: 'pendiente',
    evidencia: null,
    ...parcial,
  }
}

function kw(parcial: Partial<KeywordRow>): KeywordRow {
  return {
    id: 1,
    categoria: 'ia',
    keyword: 'a',
    tipo: 'incluye',
    prioridad: 5,
    limite_palabra: false,
    tolera_plural: true,
    activa: true,
    nota: null,
    etiquetas: 0,
    ...parcial,
  }
}

describe('catsSugeridas', () => {
  it('junta p1/p2 y votos válidos, sin duplicados ni «ninguna» ni desconocidas', () => {
    const c0 = KEYWORD_CATS[0]
    const c1 = KEYWORD_CATS[1]
    const r = cola({
      categoria_p1: c0,
      categoria_p2: 'ninguna',
      votos: { a: c1, b: c0, c: 'inventada', d: 'ninguna' },
    })
    expect(catsSugeridas(r)).toEqual([c0, c1])
  })

  it('sin sugerencias válidas devuelve []', () => {
    expect(catsSugeridas(cola({ categoria_p1: 'ninguna', votos: {} }))).toEqual([])
  })
})

describe('termino y señal de candidata', () => {
  it('terminoDe prefiere evidencia.termino y recorta; cae a senal', () => {
    expect(terminoDe(cand({ evidencia: { termino: '  rpa  ' }, senal: 'x' }))).toBe('rpa')
    expect(terminoDe(cand({ evidencia: null, senal: '  senal  ' }))).toBe('senal')
    expect(terminoDe(cand({ evidencia: { termino: 5 }, senal: 's' }))).toBe('s')
  })

  it('senalOriginal prefiere evidencia.senal_original y cae a senal', () => {
    expect(senalOriginal(cand({ evidencia: { senal_original: 'orig' }, senal: 's' }))).toBe('orig')
    expect(senalOriginal(cand({ evidencia: null, senal: 's' }))).toBe('s')
  })
})

describe('filtrarKeywords', () => {
  const rows = [
    kw({ id: 1, categoria: 'ia', tipo: 'incluye', activa: true, keyword: 'b', prioridad: 1, etiquetas: 10 }),
    kw({ id: 2, categoria: 'cloud', tipo: 'excluye', activa: false, keyword: 'a', prioridad: 9, etiquetas: 2 }),
    kw({ id: 3, categoria: 'ia', tipo: 'incluye', activa: false, keyword: 'c', prioridad: 5, etiquetas: 7 }),
  ]

  const base = { categoria: '', tipo: '', activa: 'todas' as const, sort: 'id' as never, sortAsc: true }

  it('filtra por categoría, tipo y activa', () => {
    expect(filtrarKeywords(rows, { ...base, categoria: 'ia' })).toHaveLength(2)
    expect(filtrarKeywords(rows, { ...base, tipo: 'excluye' })).toHaveLength(1)
    expect(filtrarKeywords(rows, { ...base, activa: 'activas' }).map((r) => r.id)).toEqual([1])
    expect(filtrarKeywords(rows, { ...base, activa: 'inactivas' })).toHaveLength(2)
  })

  it('ordena desc por defecto (sortAsc=false) y asc cuando se invierte', () => {
    const desc = filtrarKeywords(rows, { ...base, sort: 'etiquetas', sortAsc: false })
    expect(desc.map((r) => r.etiquetas)).toEqual([10, 7, 2])
    const asc = filtrarKeywords(rows, { ...base, sort: 'etiquetas', sortAsc: true })
    expect(asc.map((r) => r.etiquetas)).toEqual([2, 7, 10])
  })

  it('ordena alfabético por keyword y no muta la entrada', () => {
    const asc = filtrarKeywords(rows, { ...base, sort: 'keyword', sortAsc: true })
    expect(asc.map((r) => r.keyword)).toEqual(['a', 'b', 'c'])
    expect(rows.map((r) => r.id)).toEqual([1, 2, 3])
  })
})

describe('siguienteOrden', () => {
  it('misma columna invierte el sentido', () => {
    expect(siguienteOrden('keyword', true, 'keyword')).toEqual({ sort: 'keyword', sortAsc: false })
  })

  it('columna nueva: asc excepto «etiquetas» que arranca desc', () => {
    expect(siguienteOrden('keyword', true, 'prioridad')).toEqual({ sort: 'prioridad', sortAsc: true })
    expect(siguienteOrden('keyword', true, 'etiquetas')).toEqual({ sort: 'etiquetas', sortAsc: false })
  })
})

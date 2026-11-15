import { describe, expect, it } from 'vitest'
import {
  armarMenuTemas,
  cumpleTema,
  etiquetaLinea,
  etiquetaSubtema,
  lineaDe,
  normalizarTexto,
  OTROS,
  SIN_LINEA,
  SIN_TEMA,
  subtemasDe,
  temaDe,
  type TemaContrato,
} from './temas'

const contrato = (categoria_it: string | null, descripcion: string, items: { nom_cubso?: string; descripcion?: string }[] = []) =>
  ({ categoria_it, descripcion, items_json: items })

describe('subtemas por vocabulario', () => {
  it('normaliza tildes, mayúsculas y signos', () => {
    expect(normalizarTexto('ADQUISICIÓN de Tóner (HP), 2 unid.')).toBe('adquisicion de toner hp 2 unid')
  })

  it('reconoce el subtema dentro de la línea del proceso', () => {
    expect(subtemasDe(contrato('Hardware', 'ADQUISICIÓN DE IMPRESORA LÁSER'))).toEqual(['impresoras'])
    expect(subtemasDe(contrato('Redes/cableado', 'Servicio de internet satelital'))).toEqual(['internet'])
    expect(subtemasDe(contrato('Ciberseguridad', 'Renovación de licencias de antivirus'))).toEqual(['antivirus'])
  })

  it('tolera plurales, también en patrones de varias palabras', () => {
    expect(subtemasDe(contrato('Hardware', 'Compra de discos duros externos'))).toEqual(['almacenamiento'])
    expect(subtemasDe(contrato('Hardware', 'Adquisición de monitores LED'))).toEqual(['monitores'])
  })

  it('exige palabras completas: una sigla no coincide dentro de otra palabra', () => {
    // «pc» no está en «pcm» ni «ups» en «grupos».
    expect(subtemasDe(contrato('Hardware', 'Equipos para la PCM y sus grupos de trabajo'))).toEqual([])
    expect(subtemasDe(contrato('Hardware', 'Adquisición de PC y UPS'))).toEqual(['computadoras', 'energia'])
  })

  it('un proceso puede estar en varios subtemas, en el orden de las reglas', () => {
    expect(subtemasDe(contrato('Hardware', 'Adquisición de laptops, impresoras y un scanner')))
      .toEqual(['impresoras', 'computadoras', 'escaneres'])
  })

  it('las reglas de otra línea no aplican', () => {
    // «impresora» es subtema de Hardware, no de Licencias.
    expect(subtemasDe(contrato('Licencias', 'Licencia de software para impresora de carnets'))).toEqual([])
  })

  it('también lee los ítems, sin armar frases entre campos distintos', () => {
    const porItem = contrato('Hardware', 'Adquisición de equipos', [{ nom_cubso: 'IMPRESORA LASER MULTIFUNCIONAL' }])
    expect(subtemasDe(porItem)).toEqual(['impresoras'])
    const partido = contrato('Hardware', 'Compra de un disco', [{ descripcion: 'duro de roer' }])
    expect(subtemasDe(partido)).toEqual([])
  })

  it('sin línea o sin texto no hay subtemas', () => {
    expect(lineaDe({ categoria_it: null })).toBe(SIN_LINEA)
    expect(temaDe(contrato(null, 'Adquisición de impresoras'))).toEqual({ linea: SIN_LINEA, subtemas: [] })
    expect(subtemasDe({ categoria_it: 'Hardware', descripcion: '', items_json: null })).toEqual([])
  })

  it('etiquetas legibles', () => {
    expect(etiquetaLinea('IA/analytics')).toBe('IA')
    expect(etiquetaLinea(SIN_LINEA)).toBe('Otros TI')
    expect(etiquetaLinea('Linea nueva')).toBe('Linea nueva')
    expect(etiquetaSubtema('Hardware', 'impresoras')).toBe('Impresoras y multifuncionales')
    expect(etiquetaSubtema('Hardware', OTROS)).toBe('Otros')
  })
})

describe('filtro por tema', () => {
  const impresora: TemaContrato = { linea: 'Hardware', subtemas: ['impresoras'] }
  const sinSubtema: TemaContrato = { linea: 'Hardware', subtemas: [] }
  const red: TemaContrato = { linea: 'Redes/cableado', subtemas: ['internet'] }

  it('sin selección pasa todo; con línea, solo esa línea', () => {
    expect([impresora, sinSubtema, red].every(t => cumpleTema(t, SIN_TEMA))).toBe(true)
    const hardware = { linea: 'Hardware', subtema: null }
    expect([impresora, sinSubtema, red].map(t => cumpleTema(t, hardware))).toEqual([true, true, false])
  })

  it('con subtema, solo los que lo tienen; «Otros» son los que no tienen ninguno', () => {
    const impresoras = { linea: 'Hardware', subtema: 'impresoras' }
    expect([impresora, sinSubtema, red].map(t => cumpleTema(t, impresoras))).toEqual([true, false, false])
    const otros = { linea: 'Hardware', subtema: OTROS }
    expect([impresora, sinSubtema, red].map(t => cumpleTema(t, otros))).toEqual([false, true, false])
  })
})

describe('menú dinámico', () => {
  const temas: TemaContrato[] = [
    { linea: 'Hardware', subtemas: ['impresoras'] },
    { linea: 'Hardware', subtemas: ['impresoras', 'computadoras'] },
    { linea: 'Hardware', subtemas: [] },
    { linea: 'IA/analytics', subtemas: [] },
    { linea: SIN_LINEA, subtemas: [] },
  ]

  it('solo aparece lo que tiene procesos, de mayor a menor', () => {
    const menu = armarMenuTemas(temas)
    expect(menu.total).toBe(5)
    expect(menu.lineas.map(l => [l.id, l.label, l.n])).toEqual([
      ['Hardware', 'Hardware', 3],
      ['IA/analytics', 'IA', 1],
      [SIN_LINEA, 'Otros TI', 1],
    ])
    // Redes, Cloud, etc. no existen en el menú: no hay procesos.
    expect(menu.lineas.some(l => l.id === 'Redes/cableado')).toBe(false)
  })

  it('subtemas con su conteo y «Otros» al final; sin subtemas con nombre no hay segundo nivel', () => {
    const [hardware, ia] = armarMenuTemas(temas).lineas
    expect(hardware.subtemas).toEqual([
      { id: 'impresoras', label: 'Impresoras y multifuncionales', n: 2 },
      { id: 'computadoras', label: 'Computadoras y laptops', n: 1 },
      { id: OTROS, label: 'Otros', n: 1 },
    ])
    expect(ia.subtemas).toEqual([])
  })

  it('«Otros TI» va al final aunque tenga más procesos', () => {
    const menu = armarMenuTemas([
      { linea: SIN_LINEA, subtemas: [] },
      { linea: SIN_LINEA, subtemas: [] },
      { linea: 'Hardware', subtemas: [] },
    ])
    expect(menu.lineas.map(l => l.id)).toEqual(['Hardware', SIN_LINEA])
  })

  it('la selección vigente se conserva en cero para poder quitarla', () => {
    const menu = armarMenuTemas(
      [{ linea: 'Hardware', subtemas: ['impresoras'] }],
      { linea: 'Cloud/hosting', subtema: 'hosting' },
    )
    const cloud = menu.lineas.find(l => l.id === 'Cloud/hosting')
    expect(cloud).toMatchObject({ n: 0, subtemas: [{ id: 'hosting', label: 'Hosting y dominios', n: 0 }] })
    const conOtros = armarMenuTemas([{ linea: 'IA/analytics', subtemas: [] }], { linea: 'IA/analytics', subtema: OTROS })
    expect(conOtros.lineas[0].subtemas).toEqual([{ id: OTROS, label: 'Otros', n: 1 }])
  })

  it('lista vacía: menú vacío', () => {
    expect(armarMenuTemas([])).toEqual({ total: 0, lineas: [] })
  })
})

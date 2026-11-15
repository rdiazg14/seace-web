import { describe, expect, it } from 'vitest'
import type { Contrato } from '../../types'
import {
  aplicarFiltros,
  clasificarNivel,
  cronogramaIniciado,
  esEnPreparacion,
  esEtapaConsultas,
  esPorAbrir,
  esPostulable,
  esSinIniciar,
  estadoConsultas,
  nivelLabel,
  norm,
  ordenarPostulables,
  overlayDesdeTexto,
  pdfHashContrato,
  ptsMargenPct,
  puntuar,
  rankingActivo,
  resolverAnalisisParaContrato,
  resumenDiario,
  sliceDesdeFilaAnalisis,
  tieneIaReal,
  type AnalisisScoreSlice,
  type Oportunidad,
} from './model'

/** Viernes 26/09/2026 15:00 Lima (UTC−5). */
const AHORA = new Date('2026-09-26T15:00:00-05:00')

function mkContrato(over: Partial<Contrato> = {}): Contrato {
  return {
    id: 1,
    nro_contratacion: 'N° 001',
    descripcion_contrato: '',
    objeto: 'Servicio',
    descripcion: 'Servicio genérico',
    entidad: 'Entidad X',
    estado: 'Vigente',
    fecha_publica: '2026-09-25T10:00:00-05:00',
    fecha_ini_cotizacion: '2026-09-20T08:00:00-05:00',
    fecha_fin_cotizacion: '2026-10-05T23:59:00-05:00',
    tipo_cotizacion: null,
    cotizar: null,
    categoria_it: null,
    relevancia_ia: null,
    pdf_hash: 'h1',
    ...over,
  }
}

const ANALISIS_COMPLETO: AnalisisScoreSlice = {
  encaje: { rubro: 'nucleo', califica: 'si' },
  economia: { valor_estimado_soles: 10_000, margen_soles: 4_000 },
  condiciones: { modalidad: 'remoto', armadas: 1, tono_pago: 'ok', tono_plazo: 'ok', tono_penalidad: 'ok' },
  veredicto: { codigo: 'recomendado' },
}

describe('esPostulable / esPorAbrir (instante)', () => {
  it('vigente con ventana abierta es postulable', () => {
    expect(esPostulable(mkContrato(), AHORA)).toBe(true)
    expect(esPorAbrir(mkContrato(), AHORA)).toBe(false)
  })

  it('vigente vencido por instante no es postulable aunque sea el mismo día Lima', () => {
    const c = mkContrato({ fecha_fin_cotizacion: '2026-09-26T10:00:00-05:00' })
    expect(esPostulable(c, AHORA)).toBe(false)
    expect(esPorAbrir(c, AHORA)).toBe(false)
  })

  it('vigente con fecha_ini futura es por_abrir y no postulable', () => {
    const c = mkContrato({ fecha_ini_cotizacion: '2026-09-27T08:00:00-05:00' })
    expect(esPostulable(c, AHORA)).toBe(false)
    expect(esPorAbrir(c, AHORA)).toBe(true)
  })

  it('sin fecha_fin vigente con ini pasada es postulable; ini y fin vencidos no es por_abrir', () => {
    expect(esPostulable(mkContrato({ fecha_fin_cotizacion: null }), AHORA)).toBe(true)
    const pasado = mkContrato({
      fecha_ini_cotizacion: '2026-10-01T00:00:00-05:00',
      fecha_fin_cotizacion: '2026-09-25T00:00:00-05:00',
    })
    expect(esPorAbrir(pasado, AHORA)).toBe(false)
  })

  it('estado distinto de Vigente no es postulable ni por_abrir', () => {
    const c = mkContrato({ estado: 'En Evaluación' })
    expect(esPostulable(c, AHORA)).toBe(false)
    expect(esPorAbrir(c, AHORA)).toBe(false)
  })
})

describe('clasificarNivel / señales', () => {
  it('normaliza tildes y mayúsculas', () => {
    expect(norm('Telemetría ÓPTIMA')).toBe('telemetria optima')
  })

  it('categoria_it mapea a nivel según CAT_A_NIVEL', () => {
    expect(clasificarNivel(mkContrato({ categoria_it: 'IA/analytics' })).nivel).toBe('nucleo')
    expect(clasificarNivel(mkContrato({ categoria_it: 'Hardware' })).nivel).toBe('marginal')
    expect(clasificarNivel(mkContrato({ categoria_it: 'Desconocida' })).nivel).toBeNull()
  })

  it('overlay telemetría sube a núcleo; integración sube a adyacente; nunca degrada', () => {
    expect(clasificarNivel(mkContrato({ descripcion: 'plataforma SCADA' })).nivel).toBe('nucleo')
    const integracion = clasificarNivel(mkContrato({ categoria_it: 'Hardware', descripcion: 'integracion de sistemas' }))
    expect(integracion.nivel).toBe('adyacente')
    const nucleoConIntegracion = clasificarNivel(mkContrato({ categoria_it: 'IA/analytics', descripcion: 'integracion' }))
    expect(nucleoConIntegracion.nivel).toBe('nucleo')
  })

  it('"ot"/"iot" solo cuentan como token exacto, no dentro de otra palabra', () => {
    expect(overlayDesdeTexto('sistema OT en planta')).toBe('telemetria')
    expect(overlayDesdeTexto('piloto comercial')).not.toBe('telemetria')
  })

  it('relevancia ALTA con IA real sube a núcleo salvo Firma digital', () => {
    const alta = mkContrato({ relevancia_ia: 'ALTA', descripcion: 'modelo de inteligencia artificial' })
    expect(clasificarNivel(alta).altaIaReal).toBe(true)
    expect(clasificarNivel(alta).nivel).toBe('nucleo')
    const firma = mkContrato({ relevancia_ia: 'ALTA', categoria_it: 'Firma digital', descripcion: 'inteligencia artificial' })
    expect(clasificarNivel(firma).altaIaReal).toBe(false)
    expect(clasificarNivel(firma).nivel).toBe('oportunista')
  })

  it('tieneIaReal detecta vocabulario IA real', () => {
    expect(tieneIaReal('implementación de chatbot con gpt')).toBe(true)
    expect(tieneIaReal('mantenimiento de laptops')).toBe(false)
  })

  it('nivelLabel traduce o devuelve Sin clasificar', () => {
    expect(nivelLabel('nucleo')).toBe('Núcleo')
    expect(nivelLabel(null)).toBe('Sin clasificar')
  })
})

describe('puntuar — heurística (sin análisis)', () => {
  it('postulable núcleo puntúa rubro 50 + vigencia 25 + urgencia + señales y recomienda', () => {
    const c = mkContrato({ categoria_it: 'IA/analytics', relevancia_ia: 'MEDIA' })
    const o = puntuar(c, AHORA)
    expect(o.scoreFuente).toBe('heuristica')
    expect(o.score.rubro).toBe(50)
    expect(o.score.vigencia).toBe(25)
    // cierra en 9 días → urgencia 8; señales: MEDIA(3) + Servicio(2) = 5
    expect(o.score.urgencia).toBe(8)
    expect(o.score.senales).toBe(5)
    expect(o.score.total).toBe(88)
    expect(o.veredicto).toBe('recomendado')
    expect(o.veredictoGemini).toBeNull()
  })

  it('urgente solo si cierra hoy o mañana', () => {
    const hoy = puntuar(mkContrato({ categoria_it: 'IA/analytics', fecha_fin_cotizacion: '2026-09-26T20:00:00-05:00' }), AHORA)
    expect(hoy.urgente).toBe(true)
    expect(hoy.score.urgencia).toBe(10)
    const lejos = puntuar(mkContrato({ categoria_it: 'IA/analytics' }), AHORA)
    expect(lejos.urgente).toBe(false)
  })

  it('En Evaluación suma vigencia 12 y urgencia base 3; no postulable ni recomendado', () => {
    const o = puntuar(mkContrato({ estado: 'En Evaluación', categoria_it: 'IA/analytics' }), AHORA)
    expect(o.postulable).toBe(false)
    expect(o.score.vigencia).toBe(12)
    expect(o.score.urgencia).toBe(3)
    expect(o.veredicto).toBe('evaluar')
  })

  it('vigente con ventana vencida tiene urgencia 0', () => {
    const o = puntuar(mkContrato({ fecha_fin_cotizacion: '2026-09-20T20:00:00-05:00' }), AHORA)
    expect(o.score.urgencia).toBe(0)
  })
})

describe('puntuar — con análisis Gemini', () => {
  it('usa rubro del análisis, señales 0 y respeta el veredicto Gemini', () => {
    const o = puntuar(mkContrato({ categoria_it: 'Hardware' }), AHORA, ANALISIS_COMPLETO)
    expect(o.scoreFuente).toBe('analisis')
    expect(o.nivel).toBe('nucleo')
    expect(o.score.senales).toBe(0)
    expect(o.score.rubro).toBe(28)
    expect(o.score.califica).toBe(18)
    expect(o.score.margen).toBe(18)
    expect(o.margenPct).toBeCloseTo(0.4)
    expect(o.score.total).toBe(100)
    expect(o.veredicto).toBe('recomendado')
    expect(o.veredictoGemini).toBe('recomendado')
  })

  it('califica=no aplica techo 35 (único filtro absoluto)', () => {
    const a: AnalisisScoreSlice = { ...ANALISIS_COMPLETO, encaje: { rubro: 'nucleo', califica: 'no' }, veredicto: { codigo: 'no_recomendado' } }
    const o = puntuar(mkContrato(), AHORA, a)
    expect(o.score.total).toBe(35)
    expect(o.postulable).toBe(true)
    expect(o.veredicto).toBe('evaluar')
  })

  it('margen positivo menor al mínimo relevante aplica techo 55', () => {
    const a: AnalisisScoreSlice = {
      encaje: { rubro: 'nucleo', califica: 'si' },
      economia: { valor_estimado_soles: 500, margen_soles: 220 },
    }
    const o = puntuar(mkContrato({ categoria_it: 'IA/analytics' }), AHORA, a)
    expect(o.score.total).toBeLessThanOrEqual(55)
    expect(o.margenSoles).toBe(220)
  })

  it('análisis sin rubro da 10 pts de rubro y conserva el nivel keyword', () => {
    const a: AnalisisScoreSlice = { condiciones: { modalidad: 'remoto' } }
    const o = puntuar(mkContrato({ categoria_it: 'Hardware' }), AHORA, a)
    expect(o.nivel).toBe('marginal')
    expect(o.score.rubro).toBe(10)
  })

  it('bandas de margen relativo', () => {
    expect(ptsMargenPct(null, 1000)).toEqual({ pts: 6, pct: null })
    expect(ptsMargenPct(100, 0)).toEqual({ pts: 6, pct: null })
    expect(ptsMargenPct(-5, 1000).pts).toBe(0)
    expect(ptsMargenPct(500, 1000).pts).toBe(18)
    expect(ptsMargenPct(300, 1000).pts).toBe(14)
    expect(ptsMargenPct(200, 1000).pts).toBe(10)
    expect(ptsMargenPct(100, 1000).pts).toBe(5)
  })
})

describe('resolución análisis ↔ contrato', () => {
  it('solo cruza si el pdf_hash coincide con la ficha', () => {
    const c = mkContrato({ id: 7, pdf_hash: 'abc' })
    const filas = [
      { contrato_id: 7, pdf_hash: 'viejo', slice: ANALISIS_COMPLETO },
      { contrato_id: 9, pdf_hash: 'abc', slice: ANALISIS_COMPLETO },
    ]
    expect(resolverAnalisisParaContrato(c, filas)).toBeNull()
    filas.push({ contrato_id: 7, pdf_hash: 'abc', slice: ANALISIS_COMPLETO })
    expect(resolverAnalisisParaContrato(c, filas)).toBe(ANALISIS_COMPLETO)
  })

  it('pdf_hash vacío se trata como na', () => {
    expect(pdfHashContrato(mkContrato({ pdf_hash: '  ' }))).toBe('na')
    expect(pdfHashContrato(mkContrato({ pdf_hash: ' x ' }))).toBe('x')
  })

  it('sliceDesdeFilaAnalisis devuelve null si todo es nulo', () => {
    expect(sliceDesdeFilaAnalisis({ encaje: null, economia: null, condiciones: null, veredicto: null })).toBeNull()
    expect(sliceDesdeFilaAnalisis({ encaje: { rubro: 'nucleo' } })?.encaje).toEqual({ rubro: 'nucleo' })
  })
})

describe('ranking y filtros', () => {
  function mkOp(over: Partial<Contrato>, scoreTotal: number): Oportunidad {
    const o = puntuar(mkContrato(over), AHORA)
    return { ...o, score: { ...o.score, total: scoreTotal } }
  }

  it('rankingActivo deja Vigente y En Evaluación, ordena por score e id', () => {
    const items = [
      mkOp({ id: 3, estado: 'Adjudicado' }, 90),
      mkOp({ id: 1 }, 50),
      mkOp({ id: 2 }, 80),
      mkOp({ id: 4, estado: 'En Evaluación' }, 80),
    ]
    const r = rankingActivo(items)
    expect(r.map((o) => o.contrato.id)).toEqual([2, 4, 1])
  })

  it('aplicarFiltros por nivel, línea y estado', () => {
    const post = mkOp({ id: 1, categoria_it: 'IA/analytics' }, 80)
    const abrir = mkOp({ id: 2, categoria_it: 'Hardware', fecha_ini_cotizacion: '2026-10-01T00:00:00-05:00' }, 40)
    const cerrado = mkOp({ id: 3, fecha_fin_cotizacion: '2026-09-20T20:00:00-05:00' }, 10)
    const lista = [post, abrir, cerrado]
    expect(aplicarFiltros(lista, { nivel: 'nucleo', linea: null, cierre: 'todos', estado: 'postulable', ahora: AHORA }).map((o) => o.contrato.id)).toEqual([1])
    expect(aplicarFiltros(lista, { nivel: null, linea: 'Hardware', cierre: 'todos', estado: 'por_abrir', ahora: AHORA }).map((o) => o.contrato.id)).toEqual([2])
    expect(aplicarFiltros(lista, { nivel: null, linea: null, cierre: 'todos', estado: 'cerrados', ahora: AHORA }).map((o) => o.contrato.id)).toEqual([3])
  })

  it('aplicarFiltros por cierre: hoy usa instante, semana y mes usan día Lima', () => {
    const hoy = mkOp({ id: 1, fecha_fin_cotizacion: '2026-09-26T20:00:00-05:00' }, 80)
    const semana = mkOp({ id: 2, fecha_fin_cotizacion: '2026-09-30T20:00:00-05:00' }, 70)
    const mes = mkOp({ id: 3, fecha_fin_cotizacion: '2026-10-20T20:00:00-05:00' }, 60)
    const lejos = mkOp({ id: 4, fecha_fin_cotizacion: '2026-11-30T20:00:00-05:00' }, 50)
    const lista = [hoy, semana, mes, lejos]
    const base = { nivel: null, linea: null, estado: 'postulable' as const, ahora: AHORA }
    expect(aplicarFiltros(lista, { ...base, cierre: 'hoy' }).map((o) => o.contrato.id)).toEqual([1])
    expect(aplicarFiltros(lista, { ...base, cierre: 'semana' }).map((o) => o.contrato.id)).toEqual([1, 2])
    expect(aplicarFiltros(lista, { ...base, cierre: 'mes' }).map((o) => o.contrato.id)).toEqual([1, 2, 3])
  })

  it('ordenarPostulables prioriza vencimiento y desempata por score', () => {
    const hoyBajo = mkOp({ id: 1, fecha_fin_cotizacion: '2026-09-26T20:00:00-05:00' }, 30)
    const hoyAlto = mkOp({ id: 2, fecha_fin_cotizacion: '2026-09-26T21:00:00-05:00' }, 90)
    const mes = mkOp({ id: 3, fecha_fin_cotizacion: '2026-10-10T20:00:00-05:00' }, 95)
    const noPost = mkOp({ id: 4, estado: 'En Evaluación' }, 99)
    const r = ordenarPostulables([noPost, mes, hoyBajo, hoyAlto], AHORA)
    expect(r.map((o) => o.contrato.id)).toEqual([2, 1, 3, 4])
  })
})

describe('ventana de consultas (etapas_json)', () => {
  it('reconoce etapas de consulta/absolución', () => {
    expect(esEtapaConsultas('Consultas y absoluciones')).toBe(true)
    expect(esEtapaConsultas('Presentación de ofertas')).toBe(false)
    expect(esEtapaConsultas(null)).toBe(false)
  })

  it('marca abierta la etapa que contiene ahora', () => {
    const e = estadoConsultas([
      { etapa: 'Consultas', fec_ini: '2026-09-25T00:00:00-05:00', fec_fin: '2026-09-28T00:00:00-05:00' },
    ], AHORA)
    expect(e).toMatchObject({ tiene: true, abierta: true, etapa: 'Consultas' })
  })

  it('sin ventana abierta elige la futura más próxima o la última pasada', () => {
    const futura = estadoConsultas([
      { etapa: 'Consultas B', fec_ini: '2026-10-02T00:00:00-05:00', fec_fin: '2026-10-03T00:00:00-05:00' },
      { etapa: 'Consultas A', fec_ini: '2026-09-30T00:00:00-05:00', fec_fin: '2026-10-01T00:00:00-05:00' },
    ], AHORA)
    expect(futura).toMatchObject({ tiene: true, abierta: false, etapa: 'Consultas A' })
    const pasada = estadoConsultas([
      { etapa: 'Consultas viejas', fec_ini: '2026-09-10T00:00:00-05:00', fec_fin: '2026-09-12T00:00:00-05:00' },
    ], AHORA)
    expect(pasada).toMatchObject({ tiene: true, abierta: false, fin: '2026-09-12T00:00:00-05:00' })
    expect(estadoConsultas([], AHORA).tiene).toBe(false)
    expect(estadoConsultas(null, AHORA).tiene).toBe(false)
  })
})

describe('resumenDiario (KPIs del encabezado)', () => {
  it('solo cuenta postulables; agrupa cierres y desglosa el núcleo', () => {
    const scored = [
      puntuar(mkContrato({
        id: 1,
        categoria_it: 'IA/analytics',
        fecha_publica: '2026-09-26T08:00:00-05:00',
        fecha_fin_cotizacion: '2026-09-26T20:00:00-05:00',
        etapas_json: [{ etapa: 'Consultas', fec_ini: '2026-09-25T00:00:00-05:00', fec_fin: '2026-09-28T00:00:00-05:00' }],
      }), AHORA),
      puntuar(mkContrato({ id: 2, categoria_it: 'Cloud/hosting', fecha_fin_cotizacion: '2026-09-27T20:00:00-05:00' }), AHORA),
      puntuar(mkContrato({ id: 3, categoria_it: 'Desarrollo software', fecha_fin_cotizacion: '2026-10-02T20:00:00-05:00' }), AHORA),
      puntuar(mkContrato({ id: 4, categoria_it: 'Hardware', fecha_fin_cotizacion: '2026-11-30T20:00:00-05:00' }), AHORA),
      puntuar(mkContrato({ id: 5, estado: 'En Evaluación' }), AHORA),
    ]
    const r = resumenDiario(scored, AHORA)
    expect(r.nuevosHoy).toBe(1)
    expect(r.cierranHoy).toBe(1)
    expect(r.cierranManana).toBe(1)
    expect(r.cierranSemana).toBe(1)
    expect(r.nucleo).toBe(3)
    expect(r.nucleoIa).toBe(1)
    expect(r.nucleoCloud).toBe(1)
    expect(r.nucleoDev).toBe(1)
    expect(r.nucleoTel).toBe(0)
    expect(r.consultasAbiertas).toBe(1)
  })

  it('cuenta telemetría por overlay dentro del núcleo', () => {
    const scored = [
      puntuar(mkContrato({ id: 1, descripcion: 'plataforma scada' }), AHORA),
    ]
    expect(resumenDiario(scored, AHORA).nucleoTel).toBe(1)
  })
})

describe('ubicación en el Diario según el cronograma', () => {
  // Cotización del 30/09 08:00 al 30/09 12:00: todavía no abre el 26/09 15:00.
  const COTIZA = {
    fecha_ini_cotizacion: '2026-09-30T08:00:00-05:00',
    fecha_fin_cotizacion: '2026-09-30T12:00:00-05:00',
  }
  const ETAPA_COTIZA = { etapa: 'ETAPA DE COTIZACIÓN', fec_ini: COTIZA.fecha_ini_cotizacion, fec_fin: COTIZA.fecha_fin_cotizacion }
  const consultasAbiertas = mkContrato({
    id: 11,
    ...COTIZA,
    etapas_json: [
      { etapa: 'ETAPA DE CONSULTAS', fec_ini: '2026-09-25T12:00:00-05:00', fec_fin: '2026-09-28T18:00:00-05:00' },
      ETAPA_COTIZA,
    ],
  })
  const consultasCerradas = mkContrato({
    id: 12,
    ...COTIZA,
    etapas_json: [
      { etapa: 'ETAPA DE CONSULTAS', fec_ini: '2026-09-24T12:00:00-05:00', fec_fin: '2026-09-25T18:00:00-05:00' },
      ETAPA_COTIZA,
    ],
  })
  const nadaAbierto = mkContrato({
    id: 13,
    ...COTIZA,
    etapas_json: [
      { etapa: 'ETAPA DE CONSULTAS', fec_ini: '2026-09-28T09:00:00-05:00', fec_fin: '2026-09-29T09:00:00-05:00' },
      ETAPA_COTIZA,
    ],
  })
  const sinCronograma = mkContrato({ id: 14, ...COTIZA, etapas_json: null })

  it('cronogramaIniciado exige una etapa con inicio ya alcanzado', () => {
    expect(cronogramaIniciado(consultasAbiertas.etapas_json, AHORA)).toBe(true)
    expect(cronogramaIniciado(consultasCerradas.etapas_json, AHORA)).toBe(true)
    expect(cronogramaIniciado(nadaAbierto.etapas_json, AHORA)).toBe(false)
    expect(cronogramaIniciado(null, AHORA)).toBe(false)
    expect(cronogramaIniciado([{ etapa: 'Consultas', fec_ini: null, fec_fin: null }], AHORA)).toBe(false)
  })

  it('con consultas abiertas o ya cerradas está en preparación, no sin iniciar', () => {
    for (const c of [consultasAbiertas, consultasCerradas]) {
      expect(esPostulable(c, AHORA)).toBe(false)
      expect(esPorAbrir(c, AHORA)).toBe(true)
      expect(esEnPreparacion(c, AHORA)).toBe(true)
      expect(esSinIniciar(c, AHORA)).toBe(false)
    }
  })

  it('si ninguna etapa empezó, o no hay cronograma, sigue sin iniciar', () => {
    for (const c of [nadaAbierto, sinCronograma]) {
      expect(esEnPreparacion(c, AHORA)).toBe(false)
      expect(esSinIniciar(c, AHORA)).toBe(true)
    }
  })

  it('un proceso cerrado o que ya cotiza no está en preparación ni sin iniciar', () => {
    const cotizando = mkContrato({ etapas_json: consultasCerradas.etapas_json })
    const evaluacion = mkContrato({ ...COTIZA, estado: 'En Evaluación', etapas_json: consultasCerradas.etapas_json })
    for (const c of [cotizando, evaluacion]) {
      expect(esEnPreparacion(c, AHORA)).toBe(false)
      expect(esSinIniciar(c, AHORA)).toBe(false)
    }
  })

  it('aplicarFiltros lleva lo que está en preparación a la lista principal', () => {
    const lista = [consultasAbiertas, consultasCerradas, nadaAbierto, sinCronograma, mkContrato({ id: 15 })]
      .map((c) => puntuar(c, AHORA))
    const ids = (estado: 'postulable' | 'por_abrir' | 'cerrados') =>
      aplicarFiltros(lista, { nivel: null, linea: null, cierre: 'todos', estado, ahora: AHORA })
        .map((o) => o.contrato.id)
    expect(ids('postulable')).toEqual([11, 12, 15])
    expect(ids('por_abrir')).toEqual([13, 14])
    expect(ids('cerrados')).toEqual([])
  })

  it('puntuar da la misma vigencia en preparación que cotizando y no la da sin iniciar', () => {
    const cotizando = puntuar(mkContrato(), AHORA)
    const preparacion = puntuar(consultasCerradas, AHORA)
    const futura = puntuar(nadaAbierto, AHORA)
    expect(preparacion.enPreparacion).toBe(true)
    expect(preparacion.postulable).toBe(false)
    expect(preparacion.score.vigencia).toBe(cotizando.score.vigencia)
    expect(futura.enPreparacion).toBe(false)
    expect(futura.score.vigencia).toBe(0)
  })

  it('ordenarPostulables ubica lo que está en preparación por su cierre, no al final', () => {
    const cierraEnUnMes = puntuar(mkContrato({ id: 20, fecha_fin_cotizacion: '2026-10-20T12:00:00-05:00' }), AHORA)
    const preparacion = puntuar(consultasCerradas, AHORA)
    const r = ordenarPostulables([cierraEnUnMes, preparacion], AHORA)
    expect(r.map((o) => o.contrato.id)).toEqual([12, 20])
  })

  it('resumenDiario cuenta las consultas abiertas de procesos que aún no cotizan', () => {
    const scored = [consultasAbiertas, consultasCerradas, nadaAbierto].map((c) => puntuar(c, AHORA))
    expect(resumenDiario(scored, AHORA).consultasAbiertas).toBe(1)
  })
})

describe('puntaje por convocatorias anteriores desiertas', () => {
  const resumen = (desiertasPrevias: number, previas = desiertasPrevias) => ({
    numero: previas + 1,
    total: previas + 1,
    filas: [],
    previas,
    desiertasPrevias,
    adjudicadasPrevias: 0,
    sinResultadoPrevias: previas - desiertasPrevias,
  })

  it('suma 5 por una desierta y 10 por dos o más, sin análisis', () => {
    const base = puntuar(mkContrato(), AHORA)
    expect(base.score.convocatoria).toBe(0)
    const una = puntuar(mkContrato(), AHORA, null, resumen(1))
    const varias = puntuar(mkContrato(), AHORA, null, resumen(3))
    expect(una.score.convocatoria).toBe(5)
    expect(una.score.total).toBe(base.score.total + 5)
    expect(varias.score.convocatoria).toBe(10)
    expect(varias.score.total).toBe(base.score.total + 10)
  })

  it('una reconvocatoria sin desiertos previos no suma', () => {
    const base = puntuar(mkContrato(), AHORA)
    const sinDesiertos = puntuar(mkContrato(), AHORA, null, resumen(0, 2))
    expect(sinDesiertos.score.total).toBe(base.score.total)
  })

  it('con análisis también suma, pero no rompe el techo de quien no califica', () => {
    const califica: AnalisisScoreSlice = { encaje: { rubro: 'nucleo', califica: 'si' } }
    const noCalifica: AnalisisScoreSlice = { encaje: { rubro: 'nucleo', califica: 'no' } }
    const base = puntuar(mkContrato(), AHORA, califica)
    const conDesiertas = puntuar(mkContrato(), AHORA, califica, resumen(2))
    expect(conDesiertas.score.total).toBe(Math.min(100, base.score.total + 10))
    expect(puntuar(mkContrato(), AHORA, noCalifica, resumen(2)).score.total).toBeLessThanOrEqual(35)
  })
})

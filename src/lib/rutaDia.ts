/**
 * Scoring «Ruta del día» (ENERTRONIC).
 * Fuente: docs/CRITERIOS_DECISION_ENERTRONIC.md
 *
 * Con analisis_contrato (payload.analisis):
 *   rubro 28 + califica 18 + margen% 18 + modalidad 8 + pago 8
 *   + plazo 5 + riesgo 5 + vigencia 10 + urgencia 10
 *   Señales keyword = 0 (Gemini ya leyó el TDR).
 *   encaje.rubro del análisis pisa clasificarNivel.
 *   Si encaje.califica === 'no' → techo 35 (CRITERIOS §2: único filtro absoluto;
 *   el contrato sigue en la lista, solo no compite arriba).
 *   Si 0 < margen_soles < MARGEN_MINIMO_RELEVANTE → techo 55 (margen irrelevante).
 *
 * Sin análisis (fallback heurística):
 *   rubro 50 + vigencia 25 + urgencia 15 + señales 10
 *
 * Mapeo categoria_it → 4 niveles (keyword, solo sin análisis o overlay):
 *   Núcleo / Adyacente / Oportunista / Marginal — ver CAT_A_NIVEL.
 *
 * Overlay cliente: telemetría/SCADA/OT/IoT → Núcleo;
 * integración / automatización / digital twin → Adyacente. Nunca degrada.
 */
import type { Contrato } from '../types'
import type { Califica, CodigoVeredicto, Modalidad, RubroAnalisis, TonoCond } from './analisis'
import { cierraEn, cierraHoyInstante, dayOf, diffDays, limaDateISO, parseIso } from './format'

/**
 * Umbral de negocio (soles): por debajo el margen no paga el esfuerzo de postular.
 * Ajustable; no hardcodear el número en la fórmula.
 */
export const MARGEN_MINIMO_RELEVANTE = 1000

export type NivelRubro = 'nucleo' | 'adyacente' | 'oportunista' | 'marginal'

export type OverlayMotivo = 'telemetria' | 'integracion' | null

export type ScoreFuente = 'analisis' | 'heuristica'

/** Slice mínimo de payload.analisis para puntuar (PostgREST JSON path). */
export interface AnalisisScoreSlice {
  encaje?: {
    rubro?: RubroAnalisis | string | null
    califica?: Califica | string | null
  } | null
  economia?: {
    valor_estimado_soles?: number | null
    margen_soles?: number | null
  } | null
  condiciones?: {
    modalidad?: Modalidad | string | null
    armadas?: number | null
    tono_pago?: TonoCond | string | null
    tono_plazo?: TonoCond | string | null
    tono_penalidad?: TonoCond | string | null
  } | null
  veredicto?: {
    codigo?: CodigoVeredicto | string | null
  } | null
}

export interface ScoreBreakdown {
  rubro: number
  vigencia: number
  urgencia: number
  senales: number
  califica: number
  margen: number
  modalidad: number
  pago: number
  plazo: number
  riesgo: number
  total: number
}

export interface Oportunidad {
  contrato: Contrato
  nivel: NivelRubro | null
  overlay: OverlayMotivo
  altaIaReal: boolean
  score: ScoreBreakdown
  scoreFuente: ScoreFuente
  /** Margen absoluto (soles) del análisis; el score usa el %. */
  margenSoles: number | null
  margenPct: number | null
  urgente: boolean
  postulable: boolean
  porAbrir: boolean
  veredicto: 'recomendado' | 'evaluar'
  /** Veredicto Gemini cuando hay análisis usable. */
  veredictoGemini: CodigoVeredicto | null
}

export const NIVELES: { id: NivelRubro; label: string; stars: string }[] = [
  { id: 'nucleo', label: 'Núcleo', stars: '★★★' },
  { id: 'adyacente', label: 'Adyacente', stars: '★★' },
  { id: 'oportunista', label: 'Oportunista', stars: '★' },
  { id: 'marginal', label: 'Marginal', stars: '◐' },
]

export const LINEA_CHIPS: { id: string; label: string }[] = [
  { id: 'IA/analytics', label: 'IA' },
  { id: 'Cloud/hosting', label: 'Cloud' },
  { id: 'Desarrollo software', label: 'Desarrollo' },
  { id: 'Telemetria/OT', label: 'Telemetría/OT' },
  { id: 'Base de datos/ERP', label: 'BD/ERP' },
  { id: 'Hardware', label: 'Hardware' },
  { id: 'Ciberseguridad', label: 'Ciberseguridad' },
  { id: 'Licencias', label: 'Licencias' },
  { id: 'Redes/cableado', label: 'Redes' },
  { id: 'Soporte tecnico', label: 'Soporte' },
  { id: 'Microsoft', label: 'Microsoft' },
  { id: 'Oracle', label: 'Oracle' },
  { id: 'Firma digital', label: 'Firma digital' },
  { id: 'Correo electronico', label: 'Correo' },
]

/** Ciberseguridad: Oportunista según el doc; candidato a subir si aparecen contratos jugosos. */
export const CAT_A_NIVEL: Record<string, NivelRubro> = {
  'IA/analytics': 'nucleo',
  'Cloud/hosting': 'nucleo',
  'Desarrollo software': 'nucleo',
  'Telemetria/OT': 'nucleo',
  'Base de datos/ERP': 'adyacente',
  'Oracle': 'adyacente',
  'Soporte tecnico': 'oportunista',
  'Redes/cableado': 'oportunista',
  'Licencias': 'oportunista',
  'Ciberseguridad': 'oportunista',
  'Microsoft': 'oportunista',
  'Correo electronico': 'oportunista',
  'Firma digital': 'oportunista',
  'Hardware': 'marginal',
}

const RANK_NIVEL: Record<NivelRubro, number> = {
  nucleo: 3,
  adyacente: 2,
  oportunista: 1,
  marginal: 0,
}

const PTS_RUBRO: Record<NivelRubro, number> = {
  nucleo: 50,
  adyacente: 38,
  oportunista: 24,
  marginal: 12,
}

const IA_REAL = [
  'gpt',
  'llm',
  'copilot',
  'machine learning',
  'aprendizaje automatico',
  'inteligencia artificial',
  'ia generativa',
  'deep learning',
  'red neuronal',
  'modelo de lenguaje',
  'azure openai',
  'openai',
  'claude',
  'gemini',
  'chatbot',
  'asistente virtual',
  'ciencia de datos',
  'big data',
  'tokens de procesamiento',
  'tokens de ia',
]

const KW_TELEMETRIA = [
  'telemetria',
  'scada',
  'internet de las cosas',
  'tecnologia operacional',
  'tecnologias operacionales',
]

const KW_INTEGRACION = [
  'digital twin',
  'gemelo digital',
  'integracion',
  'automatizacion',
]

export const RUTA_DIA_BASE_COLS = [
  'id',
  'nro_contratacion',
  'descripcion_contrato',
  'objeto',
  'descripcion',
  'entidad',
  'estado',
  'fecha_publica',
  'fecha_ini_cotizacion',
  'fecha_fin_cotizacion',
  'tipo_cotizacion',
  'cotizar',
  'categoria_it',
  'relevancia_ia',
  'nom_area_usuaria',
] as const

export const RUTA_DIA_COLS = [
  ...RUTA_DIA_BASE_COLS,
  'pdf_archivo_id',
  'pdf_storage_path',
  'pdf_hash',
].join(',')

/** Hash del TDR en ficha; 'na' si vacío (mismo criterio que AnalisisContrato). */
export function pdfHashContrato(c: Pick<Contrato, 'pdf_hash'>): string {
  return (c.pdf_hash || '').trim() || 'na'
}

/** Select PostgREST: solo el slice de payload.analisis que usa el score. */
export const ANALISIS_SCORE_SELECT =
  'contrato_id,pdf_hash,encaje:payload->analisis->encaje,economia:payload->analisis->economia,condiciones:payload->analisis->condiciones,veredicto:payload->analisis->veredicto'

export function sliceDesdeFilaAnalisis(row: {
  encaje?: unknown
  economia?: unknown
  condiciones?: unknown
  veredicto?: unknown
}): AnalisisScoreSlice | null {
  const encaje = row.encaje
  const economia = row.economia
  const condiciones = row.condiciones
  const veredicto = row.veredicto
  if (
    (encaje == null || typeof encaje !== 'object')
    && (economia == null || typeof economia !== 'object')
    && (condiciones == null || typeof condiciones !== 'object')
    && (veredicto == null || typeof veredicto !== 'object')
  ) {
    return null
  }
  return {
    encaje: (encaje && typeof encaje === 'object' ? encaje : null) as AnalisisScoreSlice['encaje'],
    economia: (economia && typeof economia === 'object' ? economia : null) as AnalisisScoreSlice['economia'],
    condiciones: (condiciones && typeof condiciones === 'object' ? condiciones : null) as AnalisisScoreSlice['condiciones'],
    veredicto: (veredicto && typeof veredicto === 'object' ? veredicto : null) as AnalisisScoreSlice['veredicto'],
  }
}

/**
 * Cruza filas de analisis_contrato con el contrato.
 * Si pdf_hash no coincide → sin análisis (TDR cambió).
 */
export function resolverAnalisisParaContrato(
  c: Pick<Contrato, 'id' | 'pdf_hash'>,
  filas: Array<{ contrato_id: number; pdf_hash: string; slice: AnalisisScoreSlice | null }>,
): AnalisisScoreSlice | null {
  const want = pdfHashContrato(c)
  const hit = filas.find(f => f.contrato_id === c.id && f.pdf_hash === want)
  return hit?.slice ?? null
}

export function nivelLabel(nivel: NivelRubro | null): string {
  if (!nivel) return 'Sin clasificar'
  return NIVELES.find(n => n.id === nivel)?.label ?? nivel
}

export function textoContrato(c: Pick<Contrato, 'descripcion' | 'descripcion_contrato'>): string {
  return `${c.descripcion || ''} ${c.descripcion_contrato || ''}`
}

export function norm(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}

function contieneKw(haystack: string, kw: string): boolean {
  return haystack.includes(norm(kw))
}

function tokenExacto(haystack: string, token: string): boolean {
  return new RegExp(`(?:^|[^a-z0-9])${token}(?:$|[^a-z0-9])`).test(haystack)
}

export function tieneIaReal(texto: string): boolean {
  const t = norm(texto)
  return IA_REAL.some(kw => contieneKw(t, kw))
}

export function overlayDesdeTexto(texto: string): OverlayMotivo {
  const t = norm(texto)
  if (KW_TELEMETRIA.some(kw => contieneKw(t, kw)) || tokenExacto(t, 'ot') || tokenExacto(t, 'iot')) {
    return 'telemetria'
  }
  if (KW_INTEGRACION.some(kw => contieneKw(t, kw))) return 'integracion'
  return null
}

function maxNivel(a: NivelRubro | null, b: NivelRubro | null): NivelRubro | null {
  if (!a) return b
  if (!b) return a
  return RANK_NIVEL[a] >= RANK_NIVEL[b] ? a : b
}

export function clasificarNivel(c: Contrato): { nivel: NivelRubro | null; overlay: OverlayMotivo; altaIaReal: boolean } {
  // Gemelo SQL: fn_rubro_energetic en seace-monitor/capa_semantica.sql
  const texto = textoContrato(c)
  const overlay = overlayDesdeTexto(texto)
  const cat = c.categoria_it
  let nivel: NivelRubro | null = cat && CAT_A_NIVEL[cat] ? CAT_A_NIVEL[cat] : null

  if (overlay === 'telemetria') nivel = maxNivel(nivel, 'nucleo')
  else if (overlay === 'integracion') nivel = maxNivel(nivel, 'adyacente')

  const alta = (c.relevancia_ia || '').toUpperCase() === 'ALTA'
  const altaIaReal = alta && tieneIaReal(texto) && cat !== 'Firma digital'
  if (altaIaReal) nivel = maxNivel(nivel, 'nucleo')

  return { nivel, overlay, altaIaReal }
}

/** Urgencia heurística (sin análisis): 15 max. */
function ptsUrgenciaHeuristica(fechaFin: string | null, estado: string, ahora = new Date()): number {
  if (estado !== 'Vigente') return 3
  const u = cierraEn(fechaFin, ahora)
  if (u.days === null) return 3
  if (u.days < 0) return 0
  if (u.days === 0) return 10
  if (u.days === 1) return 12
  if (u.days <= 7) return 15
  if (u.days <= 30) return 8
  return 5
}

/** Urgencia con análisis: 10 max. */
function ptsUrgenciaAnalisis(fechaFin: string | null, estado: string, ahora = new Date()): number {
  if (estado !== 'Vigente') return 2
  const u = cierraEn(fechaFin, ahora)
  if (u.days === null) return 2
  if (u.days < 0) return 0
  if (u.days === 0) return 7
  if (u.days === 1) return 8
  if (u.days <= 7) return 10
  if (u.days <= 30) return 5
  return 3
}

function ptsSenales(c: Contrato, altaIaReal: boolean): number {
  let n = 0
  const ia = (c.relevancia_ia || '').toUpperCase()
  if (altaIaReal) n += 6
  else if (ia === 'MEDIA') n += 3
  else if (ia === 'BAJA') n += 1
  if (c.objeto === 'Servicio') n += 2
  return Math.min(10, n)
}

const PTS_RUBRO_ANALISIS: Record<NivelRubro, number> = {
  nucleo: 28,
  adyacente: 21,
  oportunista: 14,
  marginal: 7,
}

function nivelDesdeAnalisis(rubro: string | null | undefined): NivelRubro | null {
  if (rubro === 'nucleo' || rubro === 'adyacente' || rubro === 'oportunista' || rubro === 'marginal') {
    return rubro
  }
  return null
}

function ptsCalifica(califica: string | null | undefined, conAnalisis: boolean): number {
  if (!conAnalisis) return 9
  if (califica === 'si') return 18
  if (califica === 'justo') return 10
  if (califica === 'insuficiente_info') return 6
  if (califica === 'no') return 0
  return 9
}

/** Margen relativo: margen_soles / valor_estimado_soles (18 max). */
export function ptsMargenPct(
  margenSoles: number | null | undefined,
  valorSoles: number | null | undefined,
): { pts: number; pct: number | null } {
  if (valorSoles == null || valorSoles <= 0) return { pts: 6, pct: null }
  if (margenSoles == null || Number.isNaN(Number(margenSoles))) return { pts: 6, pct: null }
  const pct = Number(margenSoles) / Number(valorSoles)
  if (pct <= 0) return { pts: 0, pct }
  if (pct >= 0.40) return { pts: 18, pct }
  if (pct >= 0.25) return { pts: 14, pct }
  if (pct >= 0.15) return { pts: 10, pct }
  return { pts: 5, pct }
}

function ptsModalidad(m: string | null | undefined): number {
  if (m === 'remoto') return 8
  if (m === 'mixto') return 5
  if (m === 'presencial') return 2
  if (m === 'no_consta') return 4
  return 4
}

function ptsPago(armadas: number | null | undefined, tonoPago: string | null | undefined): number {
  let n: number
  if (armadas == null || Number.isNaN(Number(armadas))) n = 4
  else if (armadas === 1) n = 8
  else if (armadas >= 2 && armadas <= 3) n = 5
  else if (armadas >= 4 && armadas <= 12) n = 2
  else n = 0
  if (tonoPago === 'bad') n = Math.max(0, n - 2)
  return n
}

function ptsTono(tono: string | null | undefined): number {
  if (tono === 'ok') return 5
  if (tono === 'warn') return 3
  if (tono === 'bad') return 1
  return 3
}

function emptyBreakdown(partial: Partial<ScoreBreakdown> & Pick<ScoreBreakdown, 'rubro' | 'vigencia' | 'urgencia' | 'senales' | 'total'>): ScoreBreakdown {
  return {
    califica: 0,
    margen: 0,
    modalidad: 0,
    pago: 0,
    plazo: 0,
    riesgo: 0,
    ...partial,
  }
}

function analisisUsable(a: AnalisisScoreSlice | null | undefined): a is AnalisisScoreSlice {
  if (!a) return false
  return !!(a.encaje || a.economia || a.condiciones || a.veredicto)
}

export function puntuar(
  c: Contrato,
  ahora: Date = new Date(),
  analisis: AnalisisScoreSlice | null = null,
): Oportunidad {
  const { nivel: nivelKw, overlay, altaIaReal } = clasificarNivel(c)
  const postulable = esPostulable(c, ahora)
  const porAbrir = esPorAbrir(c, ahora)
  const cierre = cierraEn(c.fecha_fin_cotizacion, ahora)
  const vencidoVigente = c.estado === 'Vigente' && cierre.days !== null && cierre.days < 0
  const urgente = postulable && (cierre.tone === 'hoy' || cierre.tone === 'manana')

  if (!analisisUsable(analisis)) {
    const rubro = nivelKw ? PTS_RUBRO[nivelKw] : 0
    const vigencia = postulable ? 25 : c.estado === 'En Evaluación' ? 12 : 0
    const urgencia = vencidoVigente ? 0 : ptsUrgenciaHeuristica(c.fecha_fin_cotizacion, c.estado, ahora)
    const senales = ptsSenales(c, altaIaReal)
    const total = Math.min(100, rubro + vigencia + urgencia + senales)
    const veredicto: 'recomendado' | 'evaluar' =
      postulable && (nivelKw === 'nucleo' || nivelKw === 'adyacente') ? 'recomendado' : 'evaluar'
    return {
      contrato: c,
      nivel: nivelKw,
      overlay,
      altaIaReal,
      score: emptyBreakdown({ rubro, vigencia, urgencia, senales, total }),
      scoreFuente: 'heuristica',
      margenSoles: null,
      margenPct: null,
      urgente,
      postulable,
      porAbrir,
      veredicto,
      veredictoGemini: null,
    }
  }

  const rubroAnalisis = nivelDesdeAnalisis(analisis.encaje?.rubro ?? null)
  // Gemini leyó el TDR: su rubro pisa la keyword del título.
  const nivel = rubroAnalisis ?? nivelKw
  const ptsRubro = rubroAnalisis ? PTS_RUBRO_ANALISIS[rubroAnalisis] : 10
  const calificaRaw = analisis.encaje?.califica ?? null
  const ptsCal = ptsCalifica(calificaRaw, true)
  const margenSoles =
    analisis.economia?.margen_soles == null ? null : Number(analisis.economia.margen_soles)
  const valorSoles =
    analisis.economia?.valor_estimado_soles == null
      ? null
      : Number(analisis.economia.valor_estimado_soles)
  const { pts: ptsMargen, pct: margenPct } = ptsMargenPct(margenSoles, valorSoles)
  const ptsMod = ptsModalidad(analisis.condiciones?.modalidad ?? null)
  const ptsPag = ptsPago(analisis.condiciones?.armadas ?? null, analisis.condiciones?.tono_pago ?? null)
  const ptsPlazo = ptsTono(analisis.condiciones?.tono_plazo ?? null)
  const ptsRiesgo = ptsTono(analisis.condiciones?.tono_penalidad ?? null)
  const vigencia = postulable ? 10 : c.estado === 'En Evaluación' ? 5 : 0
  const urgencia = vencidoVigente ? 0 : ptsUrgenciaAnalisis(c.fecha_fin_cotizacion, c.estado, ahora)
  // Con análisis, señales keyword no suman.
  const senales = 0

  let total = Math.min(
    100,
    ptsRubro + ptsCal + ptsMargen + ptsMod + ptsPag + ptsPlazo + ptsRiesgo + vigencia + urgencia + senales,
  )
  // CRITERIOS §2: no calificar técnicamente es el ÚNICO filtro absoluto.
  // Techo 35: sigue en la lista y en filtros; solo no compite arriba.
  if (calificaRaw === 'no') {
    total = Math.min(35, total)
  }
  // Un contrato de S/500 con S/220 de margen califica y tiene condiciones
  // simples, pero el costo administrativo de postular no lo justifica.
  // No se oculta: solo no compite con los que sí mueven la aguja.
  if (
    margenSoles != null
    && !Number.isNaN(margenSoles)
    && margenSoles > 0
    && margenSoles < MARGEN_MINIMO_RELEVANTE
  ) {
    total = Math.min(55, total)
  }

  const gemini = analisis.veredicto?.codigo
  const veredictoGemini: CodigoVeredicto | null =
    gemini === 'recomendado' || gemini === 'evaluar' || gemini === 'no_recomendado' ? gemini : null
  const veredicto: 'recomendado' | 'evaluar' =
    veredictoGemini === 'recomendado'
      ? 'recomendado'
      : veredictoGemini
        ? 'evaluar'
        : postulable && (nivel === 'nucleo' || nivel === 'adyacente')
          ? 'recomendado'
          : 'evaluar'

  return {
    contrato: c,
    nivel,
    overlay,
    altaIaReal,
    score: {
      rubro: ptsRubro,
      califica: ptsCal,
      margen: ptsMargen,
      modalidad: ptsMod,
      pago: ptsPag,
      plazo: ptsPlazo,
      riesgo: ptsRiesgo,
      vigencia,
      urgencia,
      senales,
      total,
    },
    scoreFuente: 'analisis',
    margenSoles: margenSoles != null && !Number.isNaN(margenSoles) ? margenSoles : null,
    margenPct,
    urgente,
    postulable,
    porAbrir,
    veredicto,
    veredictoGemini,
  }
}

function instanteMs(iso: string | null): number | null {
  return parseIso(iso)?.getTime() ?? null
}

/**
 * Hasta B21 las fechas estaban 5h corridas y comparar el instante daba
 * falsos negativos; por eso se comparaba el día Lima. Con las fechas
 * corregidas el instante es el criterio correcto: un contrato que cierra
 * hoy 15:08 no es postulable a las 22:52.
 */
export function esPostulable(
  contrato: Pick<Contrato, 'estado' | 'fecha_fin_cotizacion' | 'fecha_ini_cotizacion'>,
  ahora: Date = new Date(),
): boolean {
  if (contrato.estado !== 'Vigente') return false
  const now = ahora.getTime()
  const ini = instanteMs(contrato.fecha_ini_cotizacion)
  if (ini != null && ini > now) return false
  const fin = instanteMs(contrato.fecha_fin_cotizacion)
  if (fin == null) return true
  return fin >= now
}

/** Vigente cuya ventana de cotización todavía no abre (`fecha_ini` > ahora). */
export function esPorAbrir(
  contrato: Pick<Contrato, 'estado' | 'fecha_ini_cotizacion' | 'fecha_fin_cotizacion'>,
  ahora: Date = new Date(),
): boolean {
  if (contrato.estado !== 'Vigente') return false
  const now = ahora.getTime()
  const ini = instanteMs(contrato.fecha_ini_cotizacion)
  if (ini == null || ini <= now) return false
  const fin = instanteMs(contrato.fecha_fin_cotizacion)
  if (fin != null && fin < now) return false
  return true
}

/** Universo puntuado: Vigente (incl. vencidos) + En Evaluación. El chip recorta postulable. */
export function rankingActivo(items: Oportunidad[]): Oportunidad[] {
  return items
    .filter(o => o.contrato.estado === 'Vigente' || o.contrato.estado === 'En Evaluación')
    .sort((a, b) => b.score.total - a.score.total || a.contrato.id - b.contrato.id)
}

export type FiltroCierre = 'todos' | 'hoy' | 'semana' | 'mes'
export type FiltroEstado = 'postulable' | 'por_abrir' | 'cerrados'

export function aplicarFiltros(
  ranking: Oportunidad[],
  opts: {
    nivel: NivelRubro | null
    linea: string | null
    cierre: FiltroCierre
    estado: FiltroEstado
    ahora?: Date
  },
): Oportunidad[] {
  const ahora = opts.ahora ?? new Date()
  const today = limaDateISO(ahora)
  return ranking.filter(o => {
    if (opts.nivel && o.nivel !== opts.nivel) return false
    if (opts.linea && o.contrato.categoria_it !== opts.linea) return false
    if (opts.estado === 'postulable' && !esPostulable(o.contrato, ahora)) return false
    if (opts.estado === 'por_abrir' && !esPorAbrir(o.contrato, ahora)) return false
    if (opts.estado === 'cerrados' && (esPostulable(o.contrato, ahora) || esPorAbrir(o.contrato, ahora))) return false
    if (opts.cierre !== 'todos') {
      const fin = o.contrato.fecha_fin_cotizacion
      if (!fin) return false
      if (opts.cierre === 'hoy') return cierraHoyInstante(fin, ahora)
      const d = dayOf(fin)
      if (!d) return false
      const days = diffDays(today, d)
      if (opts.cierre === 'semana' && (days < 0 || days > 7)) return false
      if (opts.cierre === 'mes' && (days < 0 || days > 30)) return false
    }
    return true
  })
}

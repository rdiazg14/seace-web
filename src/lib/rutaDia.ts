/**
 * Scoring preliminar «Ruta del día» (ENERTRONIC) — 100% desde BD, sin IA.
 * Fuente: docs/CRITERIOS_DECISION_ENERTRONIC.md
 *
 * Fórmula 0–100 (aprobada):
 *   score = rubro(50) + vigencia(25) + urgencia(15) + señales(10)
 *
 *   Rubro:     Núcleo 50 · Adyacente 38 · Oportunista 24 · Marginal 12
 *   Vigencia:  Vigente 25 · En Evaluación 12
 *   Urgencia:  hoy 10 · mañana 12 · 2–7 días 15 · 8–30 días 8 · >30 días 5 · sin fecha 3
 *              (2–7 días > hoy: «cierra hoy» es bandera ⚡, no dominancia)
 *   Señales:   relevancia_ia ALTA+IA real 6 / MEDIA 3 / BAJA 1 · objeto Servicio +2
 *
 * Modalidad / pago / margen / plazo / penalidades = 0 hasta fase #10.
 *
 * Mapeo categoria_it → 4 niveles (aprobado):
 *   Núcleo      IA/analytics, Cloud/hosting, Desarrollo software
 *   Adyacente   Base de datos/ERP, Oracle
 *   Oportunista Soporte, Redes, Licencias, Ciberseguridad (candidato a subir),
 *               Microsoft, Correo, Firma digital
 *   Marginal    Hardware
 *
 * Firma digital + relevancia_ia ALTA NO sube a Núcleo (token cripto ≠ tokens de IA).
 * ALTA sube a Núcleo solo con contexto IA real (GPT/LLM/Copilot/ML) en el texto.
 *
 * Overlay cliente (no toca BD): telemetría/SCADA/OT/IoT → Núcleo;
 * integración / automatización / digital twin → Adyacente. Nunca degrada.
 */
import type { Contrato } from '../types'
import { cierraEn, cierraHoyInstante, dayOf, diffDays, limaDateISO, parseIso } from './format'

export type NivelRubro = 'nucleo' | 'adyacente' | 'oportunista' | 'marginal'

export type OverlayMotivo = 'telemetria' | 'integracion' | null

export interface ScoreBreakdown {
  rubro: number
  vigencia: number
  urgencia: number
  senales: number
  total: number
}

export interface Oportunidad {
  contrato: Contrato
  nivel: NivelRubro | null
  overlay: OverlayMotivo
  altaIaReal: boolean
  score: ScoreBreakdown
  urgente: boolean
  postulable: boolean
  porAbrir: boolean
  veredicto: 'recomendado' | 'evaluar'
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
].join(',')

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

function ptsUrgencia(fechaFin: string | null, estado: string, ahora = new Date()): number {
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

function ptsSenales(c: Contrato, altaIaReal: boolean): number {
  let n = 0
  const ia = (c.relevancia_ia || '').toUpperCase()
  if (altaIaReal) n += 6
  else if (ia === 'MEDIA') n += 3
  else if (ia === 'BAJA') n += 1
  if (c.objeto === 'Servicio') n += 2
  return Math.min(10, n)
}

export function puntuar(c: Contrato, ahora = new Date()): Oportunidad {
  const { nivel, overlay, altaIaReal } = clasificarNivel(c)
  const postulable = esPostulable(c, ahora)
  const porAbrir = esPorAbrir(c, ahora)
  const cierre = cierraEn(c.fecha_fin_cotizacion, ahora)
  const vencidoVigente = c.estado === 'Vigente' && cierre.days !== null && cierre.days < 0
  const urgente = postulable && (cierre.tone === 'hoy' || cierre.tone === 'manana')

  const rubro = nivel ? PTS_RUBRO[nivel] : 0
  const vigencia = postulable ? 25 : c.estado === 'En Evaluación' ? 12 : 0
  const urgencia = vencidoVigente ? 0 : ptsUrgencia(c.fecha_fin_cotizacion, c.estado, ahora)
  const senales = ptsSenales(c, altaIaReal)
  const total = Math.min(100, rubro + vigencia + urgencia + senales)

  const veredicto: 'recomendado' | 'evaluar' =
    postulable && (nivel === 'nucleo' || nivel === 'adyacente') ? 'recomendado' : 'evaluar'

  return {
    contrato: c,
    nivel,
    overlay,
    altaIaReal,
    score: { rubro, vigencia, urgencia, senales, total },
    urgente,
    postulable,
    porAbrir,
    veredicto,
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

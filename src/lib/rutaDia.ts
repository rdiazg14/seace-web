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
import { cierraEn, dayOf, diffDays, limaDateISO } from './format'

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

export const RUTA_DIA_COLS = [
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

function ptsUrgencia(fechaFin: string | null, estado: string): number {
  if (estado !== 'Vigente') return 3
  const u = cierraEn(fechaFin)
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

export function puntuar(c: Contrato): Oportunidad {
  const { nivel, overlay, altaIaReal } = clasificarNivel(c)
  const postulable = esPostulable(c)
  const cierre = cierraEn(c.fecha_fin_cotizacion)
  const vencidoVigente = c.estado === 'Vigente' && cierre.days !== null && cierre.days < 0
  const urgente = postulable && (cierre.tone === 'hoy' || cierre.tone === 'manana')

  const rubro = nivel ? PTS_RUBRO[nivel] : 0
  const vigencia = postulable ? 25 : c.estado === 'En Evaluación' ? 12 : 0
  const urgencia = vencidoVigente ? 0 : ptsUrgencia(c.fecha_fin_cotizacion, c.estado)
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
    veredicto,
  }
}

/** Fuente de verdad: vigente con ventana abierta (día Lima) o sin fecha de cierre. */
export function esPostulable(
  contrato: Pick<Contrato, 'estado' | 'fecha_fin_cotizacion'>,
  today = limaDateISO(),
): boolean {
  if (contrato.estado !== 'Vigente') return false
  const d = dayOf(contrato.fecha_fin_cotizacion)
  if (!d) return true
  return d >= today
}

/** Universo puntuado: Vigente (incl. vencidos) + En Evaluación. El chip recorta postulable. */
export function rankingActivo(items: Oportunidad[]): Oportunidad[] {
  return items
    .filter(o => o.contrato.estado === 'Vigente' || o.contrato.estado === 'En Evaluación')
    .sort((a, b) => b.score.total - a.score.total || a.contrato.id - b.contrato.id)
}

export type FiltroCierre = 'todos' | 'hoy' | 'semana' | 'mes'
export type FiltroEstado = 'postulable' | 'cerrados'

export function aplicarFiltros(
  ranking: Oportunidad[],
  opts: {
    nivel: NivelRubro | null
    linea: string | null
    cierre: FiltroCierre
    estado: FiltroEstado
    today?: string
  },
): Oportunidad[] {
  const today = opts.today ?? limaDateISO()
  return ranking.filter(o => {
    if (opts.nivel && o.nivel !== opts.nivel) return false
    if (opts.linea && o.contrato.categoria_it !== opts.linea) return false
    if (opts.estado === 'postulable' && !esPostulable(o.contrato, today)) return false
    if (opts.estado === 'cerrados' && esPostulable(o.contrato, today)) return false
    if (opts.cierre !== 'todos') {
      const d = dayOf(o.contrato.fecha_fin_cotizacion)
      if (!d) return false
      const days = diffDays(today, d)
      if (opts.cierre === 'hoy' && days !== 0) return false
      if (opts.cierre === 'semana' && (days < 0 || days > 7)) return false
      if (opts.cierre === 'mes' && (days < 0 || days > 30)) return false
    }
    return true
  })
}

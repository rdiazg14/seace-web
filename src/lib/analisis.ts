export const TECHO_8_UIT_SOLES = 42800

export type RubroAnalisis = 'nucleo' | 'adyacente' | 'oportunista' | 'marginal' | 'desconocido'
export type Califica = 'si' | 'justo' | 'no' | 'insuficiente_info'
export type Modalidad = 'remoto' | 'presencial' | 'mixto' | 'no_consta'
export type TonoCond = 'ok' | 'warn' | 'bad'
export type CodigoVeredicto = 'recomendado' | 'evaluar' | 'no_recomendado'

export interface AnalisisEncaje {
  rubro: RubroAnalisis
  califica: Califica
  perfil_pedido: string
  razon: string
}

export interface AnalisisCondiciones {
  modalidad: Modalidad
  modalidad_detalle: string
  pago: string
  armadas: number | null
  plazo: string
  penalidades: string
  tono_modalidad: TonoCond
  tono_pago: TonoCond
  tono_plazo: TonoCond
  tono_penalidad: TonoCond
}

export interface AnalisisEconomia {
  valor_estimado_soles: number | null
  pistas_valor: string
  costo_estimado_soles: number | null
  margen_soles: number | null
  supuestos: string[]
  lo_que_no_sabe: string[]
}

export interface AnalisisVeredicto {
  codigo: CodigoVeredicto
  razonamiento: string
  aviso_humano: string
}

export interface EntregableContractual {
  nombre: string
  plazo_dias?: number | null
  plazo_referencia?: 'desde_notificacion' | 'desde_conclusion' | 'otro'
  descripcion: string
  riesgo_penalidad: 'alto' | 'medio' | 'bajo'
}

export interface ComponenteServicio {
  nombre: string
  participantes_max?: number | null
  horas_min?: number | null
  sesiones_min?: number | null
  modalidad?: string
  temario?: string[]
}

export interface ClausulaCritica {
  clausula: string
  descripcion: string
  impacto: 'alto' | 'medio' | 'bajo'
}

export interface RequisitosProveedor {
  habilitaciones?: string[]
  experiencia_minima?: string | null
  certificaciones_especificas?: string[]
  documentos_acreditacion?: string[]
  admite_consorcio?: boolean | null
}

export interface RiesgosContractuales {
  penalidad_formula?: string | null
  penalidad_factor_f?: number | null
  penalidad_tope_pct?: number | null
  propiedad_materiales?: 'cliente' | 'proveedor' | 'compartida' | 'no_consta' | null
  plataforma_provee?: 'proveedor' | 'cliente' | 'no_consta' | null
  clausulas_criticas?: ClausulaCritica[]
}

export interface AnalisisPayload {
  resumen: string
  encaje: AnalisisEncaje
  condiciones: AnalisisCondiciones
  economia: AnalisisEconomia
  veredicto: AnalisisVeredicto
  optimizacion: string[]
  estructura_contractual?: { entregables?: EntregableContractual[] } | null
  componentes_servicio?: ComponenteServicio[] | null
  requisitos_proveedor?: RequisitosProveedor | null
  riesgos_contractuales?: RiesgosContractuales | null
  chips_sugeridos?: string[] | null
}

export interface AnalisisResponse {
  contrato_id: number
  nro: string
  entidad: string
  estado: string
  url: string
  tdr_fuente: 'tdr_texto' | 'chunks' | 'ficha'
  tdr_chars: number
  techo_soles: number
  urgente: boolean
  analisis: AnalisisPayload
  error?: string
}

export interface EscenarioPayload {
  escenario: string
  supuestos_aplicados: string[]
  cambio_vs_analisis: string
  sigue_sin_saberse: string[]
  valor_estimado_soles: number | null
  costo_estimado_soles: number | null
  margen_estimado_soles: number | null
  nota: string
}

/** Fail-closed: sin supuestos_aplicados no vacío, la UI no pinta montos. */
export function escenarioMuestraCifras(e: EscenarioPayload | null | undefined): boolean {
  return Boolean(e && Array.isArray(e.supuestos_aplicados) && e.supuestos_aplicados.length > 0)
}

export function soles(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return 'sin estimar'
  return n.toLocaleString('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 })
}

export function labelRubro(r: RubroAnalisis): string {
  return ({
    nucleo: 'Núcleo',
    adyacente: 'Adyacente',
    oportunista: 'Oportunista',
    marginal: 'Marginal',
    desconocido: 'Sin clasificar',
  })[r]
}

export function labelCalifica(c: Califica): string {
  return ({
    si: 'Califica',
    justo: 'Califica justo',
    no: 'No califica',
    insuficiente_info: 'Falta info para calificar',
  })[c]
}

export function labelModalidad(m: Modalidad): string {
  return ({
    remoto: 'Remoto',
    presencial: 'Presencial',
    mixto: 'Mixto',
    no_consta: 'No consta',
  })[m]
}

export function labelVeredicto(c: CodigoVeredicto): string {
  return ({
    recomendado: 'Recomendado',
    evaluar: 'Evaluar / ajustable',
    no_recomendado: 'No recomendado',
  })[c]
}

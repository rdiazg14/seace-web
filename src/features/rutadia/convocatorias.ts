/**
 * Convocatorias de un mismo requerimiento (1.ª, 2.ª, 3.ª…).
 *
 * El portal publica cada reconvocatoria como un proceso nuevo y no dice cuál
 * es. La vista `v_convocatorias` las agrupa por entidad y descripción; aquí
 * se resume ese grupo para mostrarlo: una reconvocatoria tras un desierto
 * suele indicar poca competencia.
 */

/** Fila de `v_convocatorias`: una convocatoria del requerimiento de `contrato_id`. */
export interface ConvocatoriaFila {
  contrato_id: number
  convocatoria_id: number
  /** Posición por fecha de publicación dentro del grupo, desde 1. */
  numero: number
  total: number
  es_actual: boolean
  nro_contratacion: string | null
  descripcion_contrato: string | null
  estado: string | null
  fecha_publica: string | null
  fecha_ini_cotizacion: string | null
  fecha_fin_cotizacion: string | null
  resultado: string | null
  proveedor_ganador: string | null
  monto_adjudicado: number | null
  pdf_archivo_id: number | null
  pdf_storage_path: string | null
}

export const CONVOCATORIAS_SELECT = [
  'contrato_id',
  'convocatoria_id',
  'numero',
  'total',
  'es_actual',
  'nro_contratacion',
  'descripcion_contrato',
  'estado',
  'fecha_publica',
  'fecha_ini_cotizacion',
  'fecha_fin_cotizacion',
  'resultado',
  'proveedor_ganador',
  'monto_adjudicado',
  'pdf_archivo_id',
  'pdf_storage_path',
].join(',')

export type ResultadoConvocatoria = 'desierto' | 'adjudicado' | 'sin_resultado'

export interface ResumenConvocatorias {
  /** Número de convocatoria de este proceso dentro del grupo. */
  numero: number
  total: number
  /** Todas las convocatorias del grupo, de la más antigua a la más reciente. */
  filas: ConvocatoriaFila[]
  /** Conteos de las convocatorias anteriores a este proceso. */
  previas: number
  desiertasPrevias: number
  adjudicadasPrevias: number
  sinResultadoPrevias: number
}

export function resultadoDe(fila: Pick<ConvocatoriaFila, 'resultado'>): ResultadoConvocatoria {
  const r = (fila.resultado ?? '').trim().toUpperCase()
  if (r === 'DESIERTO') return 'desierto'
  if (r === 'ADJUDICADO') return 'adjudicado'
  return 'sin_resultado'
}

/** Agrupa las filas de la vista por proceso. Descarta grupos sin la fila del propio proceso. */
export function agruparConvocatorias(filas: ConvocatoriaFila[]): Map<number, ResumenConvocatorias> {
  const porContrato = new Map<number, ConvocatoriaFila[]>()
  for (const f of filas) {
    const lista = porContrato.get(f.contrato_id)
    if (lista) lista.push(f)
    else porContrato.set(f.contrato_id, [f])
  }
  const out = new Map<number, ResumenConvocatorias>()
  for (const [contratoId, lista] of porContrato) {
    const ordenadas = [...lista].sort((a, b) => a.numero - b.numero)
    const actual = ordenadas.find(f => f.es_actual)
    if (!actual || ordenadas.length < 2) continue
    const anteriores = ordenadas.filter(f => f.numero < actual.numero)
    let desiertas = 0
    let adjudicadas = 0
    for (const f of anteriores) {
      const r = resultadoDe(f)
      if (r === 'desierto') desiertas += 1
      else if (r === 'adjudicado') adjudicadas += 1
    }
    out.set(contratoId, {
      numero: actual.numero,
      total: ordenadas.length,
      filas: ordenadas,
      previas: anteriores.length,
      desiertasPrevias: desiertas,
      adjudicadasPrevias: adjudicadas,
      sinResultadoPrevias: anteriores.length - desiertas - adjudicadas,
    })
  }
  return out
}

/** 2 → «2.ª». */
export function ordinalConvocatoria(n: number): string {
  return `${n}.ª`
}

export type TonoConvocatoria = 'desierta' | 'adjudicada' | 'neutro'

export interface EtiquetaConvocatoria {
  texto: string
  tono: TonoConvocatoria
}

/**
 * Etiqueta de la tarjeta. Solo existe a partir de la 2.ª convocatoria y dice
 * siempre qué pasó antes: «2.ª convocatoria» sola no distingue un desierto de
 * una compra que se repite.
 */
export function etiquetaConvocatoria(r: ResumenConvocatorias | null | undefined): EtiquetaConvocatoria | null {
  if (!r || r.numero < 2 || r.previas < 1) return null
  const base = `${ordinalConvocatoria(r.numero)} convocatoria`
  const una = r.previas === 1
  if (r.desiertasPrevias > 0) {
    const detalle = una
      ? 'anterior desierta'
      : r.desiertasPrevias === r.previas
        ? `${r.previas} desiertas`
        : `${r.desiertasPrevias} de ${r.previas} desiertas`
    return { texto: `${base} · ${detalle}`, tono: 'desierta' }
  }
  if (r.adjudicadasPrevias > 0) {
    const detalle = una
      ? 'anterior adjudicada'
      : r.adjudicadasPrevias === r.previas
        ? `${r.previas} adjudicadas`
        : `${r.adjudicadasPrevias} de ${r.previas} adjudicadas`
    return { texto: `${base} · ${detalle}`, tono: 'adjudicada' }
  }
  return { texto: `${base} · ${una ? 'anterior sin resultado' : 'anteriores sin resultado'}`, tono: 'neutro' }
}

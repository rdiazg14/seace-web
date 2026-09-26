// Seguimiento por contrato del pipeline de IA/embedding (proceso_evento).
// Sección de Observabilidad a nivel especialista: KPIs, distribuciones,
// tabla maestra filtrable/paginada y timeline de eventos por contrato.

export const PAGE = 25

export const ETAPA_LABEL: Record<string, string> = {
  tdr_extraido: 'TDR extraído',
  contenedor: 'Contenedor',
  chunked: 'Chunked',
  embedded: 'Embedded',
  migrado_300_60: 'Migrado 300/60',
}

export const ETAPA_COLOR: Record<string, string> = {
  tdr_extraido: '#0EA5E9',
  contenedor: '#F59E0B',
  chunked: '#6366F1',
  embedded: '#8B5CF6',
  migrado_300_60: '#10B981',
}

export const ETAPA_ORDEN = ['tdr_extraido', 'contenedor', 'chunked', 'embedded', 'migrado_300_60']

export const CHUNK_VERSION_LABEL: Record<string, string> = {
  '500_0': '500/0 · legacy',
  '300_60': '300/60 · overlap',
}

export const CHUNK_VERSION_COLOR: Record<string, string> = {
  '500_0': '#94A3B8',
  '300_60': '#10B981',
}

export const TIPO_LABEL: Record<string, string> = {
  pdf: 'PDF nativo',
  ocr: 'PDF + OCR',
  contenedor_docx: 'DOCX',
  contenedor_zip: 'ZIP',
  contenedor_rar: 'RAR',
  contenedor_doc: 'DOC',
  sin_dato: 'Sin dato',
}

export interface FilaContrato {
  contrato_id: number
  nro_contratacion: string | null
  descripcion: string | null
  estado: string | null
  fecha_fin_cotizacion: string | null
  fecha_publica: string | null
  tdr_tipo_extraccion: string | null
  chunk_version: string
  tdr_chars: number
  n_chunks_pdf: number
  n_chunks_api: number
  n_chunks_total: number
  n_embebidos_v2: number
  ultima_etapa: string | null
  ultimo_evento_at: string | null
  costo_embed_acum: number
  n_eventos: number
}

export interface SeguimientoData {
  total: number
  filas: FilaContrato[]
}

export interface ResumenData {
  contratos_con_eventos: number
  eventos_total: number
  ultimo_evento_at: string | null
  primer_evento_at: string | null
  chunks_pdf: number
  chunks_api: number
  chunks_total: number
  embebidos_v2: number
  cobertura_emb_pct: number
  costo_embed_usd: number
  tokens_embed_est: number
  por_etapa: Array<{ etapa: string; eventos: number; contratos: number; costo_usd: number; chunks_pdf_sum: number; chars_sum: number }>
  por_chunk_version: Array<{ chunk_version: string; contratos: number }>
  por_tipo_extraccion: Array<{ tipo_extraccion: string; contratos: number }>
  por_dia: Array<{ dia: string; eventos: number; costo_usd: number }>
}

export interface EventoContrato {
  id: number
  created_at: string
  etapa: string
  n_chunks_pdf: number | null
  n_chunks_api: number | null
  chars_tdr: number | null
  tokens_est: number | null
  costo_usd: number | null
  tipo_extraccion: string | null
  chunk_version: string | null
  run_id: string | null
  detalle: Record<string, unknown> | null
}

export function fmtNum(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString('es-PE')
}

export function fmtUsd(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n <= 0) return '$0.00'
  if (n < 0.01) return '<$0.01'
  return `$${n.toFixed(3).replace(/\.?0+$/, '')}`
}

export function fmtChars(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

export interface DonutSlice {
  name: string
  value: number
  color: string
  pct: number
}

export function donutPorEtapa(resumen: ResumenData | null): DonutSlice[] {
  if (!resumen) return []
  const total = resumen.por_etapa.reduce((a, e) => a + e.eventos, 0)
  return resumen.por_etapa
    .map((e) => ({
      name: ETAPA_LABEL[e.etapa] ?? e.etapa,
      value: e.eventos,
      color: ETAPA_COLOR[e.etapa] ?? '#64748B',
      pct: total > 0 ? (e.eventos / total) * 100 : 0,
    }))
    .filter((d) => d.value > 0)
}

export function donutPorVersion(resumen: ResumenData | null): DonutSlice[] {
  if (!resumen) return []
  const total = resumen.por_chunk_version.reduce((a, e) => a + e.contratos, 0)
  return resumen.por_chunk_version
    .map((e) => ({
      name: CHUNK_VERSION_LABEL[e.chunk_version] ?? e.chunk_version,
      value: e.contratos,
      color: CHUNK_VERSION_COLOR[e.chunk_version] ?? '#64748B',
      pct: total > 0 ? (e.contratos / total) * 100 : 0,
    }))
    .filter((d) => d.value > 0)
}

export function barrasPorTipo(resumen: ResumenData | null): { name: string; value: number }[] {
  if (!resumen) return []
  return [...resumen.por_tipo_extraccion]
    .sort((a, b) => b.contratos - a.contratos)
    .map((t) => ({ name: TIPO_LABEL[t.tipo_extraccion] ?? t.tipo_extraccion, value: t.contratos }))
}

export function totalPaginas(tabla: SeguimientoData | null): number {
  return tabla ? Math.max(1, Math.ceil(tabla.total / PAGE)) : 1
}

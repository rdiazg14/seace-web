export interface Contrato {
  id: number
  nro_contratacion: string
  descripcion_contrato: string
  objeto: string
  descripcion: string
  entidad: string
  estado: string
  fecha_publica: string | null
  fecha_ini_cotizacion: string | null
  fecha_fin_cotizacion: string | null
  tipo_cotizacion: string | null
  cotizar: boolean | null
  categoria_it: string | null
  relevancia_ia: string | null
  rank?: number
}

export interface DashboardResumen {
  objeto: string
  estado: string
  categoria_it: string | null
  mes: string
  total: number
}

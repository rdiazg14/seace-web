export interface ItemCubso {
  cod_cubso?: string | null
  nom_cubso?: string | null
  descripcion?: string | null
  cantidad?: number | string | null
  unidad?: string | null
  distrito?: string | null
}

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
  nom_area_usuaria?: string | null
  items_json?: ItemCubso[] | null
  detalle_cargado?: boolean | null
  rank?: number
}

export interface DashboardResumen {
  objeto: string
  estado: string
  categoria_it: string | null
  mes: string
  total: number
}

export interface ContratoRef {
  id: number
  nro: string
  entidad: string
  estado?: string
  url: string
}

export type Rol = 'admin' | 'normal'

export interface Perfil {
  id: string
  email: string
  rol: Rol
  creado_por: string | null
  created_at: string
}

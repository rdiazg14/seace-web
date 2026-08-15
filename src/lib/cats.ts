export const IT_CHIPS = [
  { id: 'Hardware', label: 'Hardware' },
  { id: 'Desarrollo software', label: 'Desarrollo' },
  { id: 'Licencias', label: 'Licencias' },
  { id: 'Cloud/hosting', label: 'Cloud' },
  { id: 'Ciberseguridad', label: 'Ciberseguridad' },
  { id: 'IA/analytics', label: 'IA' },
  { id: 'Redes/cableado', label: 'Redes' },
  { id: 'Base de datos/ERP', label: 'BD/ERP' },
  { id: 'Microsoft', label: 'Microsoft' },
  { id: 'Oracle', label: 'Oracle' },
] as const

export const OBJETOS = ['Bien', 'Servicio', 'Obra', 'Consultoría de Obra'] as const

export const ESTADOS = ['Vigente', 'En Evaluación', 'Culminado'] as const

export function labelCat(id: string | null | undefined): string {
  if (!id) return ''
  const hit = IT_CHIPS.find(c => c.id === id)
  return hit?.label ?? id
}

export function tipoEntidad(nombre: string): string {
  const n = (nombre || '').toUpperCase()
  if (n.includes('MUNICIPALIDAD')) return 'Municipalidad'
  if (n.includes('UNIVERSIDAD')) return 'Universidad'
  if (n.includes('HOSPITAL') || n.includes('ESSALUD') || n.includes('SALUD')) return 'Salud'
  if (n.includes('GOBIERNO REGIONAL') || n.includes('GOB. REGIONAL') || n.includes('GRE-')) {
    return 'Gob. Regional'
  }
  if (
    n.includes('MINISTERIO') ||
    n.includes('PRESIDENCIA') ||
    n.includes('SUNAT') ||
    n.includes('OSCE') ||
    n.includes('SBS') ||
    n.includes('CONTRALORIA') ||
    n.includes('SUPERINTENDENCIA') ||
    n.includes('ORGANISMO')
  ) return 'Gob. Central'
  if (n.includes('SEDAPAR') || n.includes('SEDAPAL') || n.includes('ELECTRO') || n.includes('S.A')) {
    return 'Empresa pública'
  }
  return 'Otros'
}

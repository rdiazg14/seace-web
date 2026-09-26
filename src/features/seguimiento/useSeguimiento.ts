import { useEffect, useMemo, useState } from 'react'
import { useTheme } from '../../lib/theme'
import {
  barrasPorTipo,
  donutPorEtapa,
  donutPorVersion,
  totalPaginas,
  type FilaContrato,
  type ResumenData,
  type SeguimientoData,
} from './model'
import { cargarResumen, cargarTabla } from './api'

export function useSeguimiento() {
  const { theme } = useTheme()
  const axis = theme === 'dark' ? '#94a3b8' : '#64748b'
  const grid = theme === 'dark' ? '#1e293b' : '#e2e8f0'
  const tipBg = theme === 'dark' ? '#0f172a' : '#fff'
  const tipFg = theme === 'dark' ? '#e2e8f0' : '#0f172a'

  const [resumen, setResumen] = useState<ResumenData | null>(null)
  const [resumenErr, setResumenErr] = useState<string | null>(null)
  const [resumenLoading, setResumenLoading] = useState(true)

  const [tabla, setTabla] = useState<SeguimientoData | null>(null)
  const [tablaErr, setTablaErr] = useState<string | null>(null)
  const [tablaLoading, setTablaLoading] = useState(true)

  const [page, setPage] = useState(0)
  const [fEstado, setFEstado] = useState('')
  const [fVersion, setFVersion] = useState('')
  const [fEtapa, setFEtapa] = useState('')
  const [fBusqueda, setFBusqueda] = useState('')
  const [busquedaInput, setBusquedaInput] = useState('')

  const [detalle, setDetalle] = useState<FilaContrato | null>(null)

  async function loadResumen() {
    setResumenLoading(true)
    setResumenErr(null)
    const { data, error } = await cargarResumen()
    if (error) {
      setResumenErr(error)
      setResumen(null)
      setResumenLoading(false)
      return
    }
    setResumen(data)
    setResumenLoading(false)
  }

  async function loadTabla(p = page, estado = fEstado, version = fVersion, etapa = fEtapa, busqueda = fBusqueda) {
    setTablaLoading(true)
    setTablaErr(null)
    const { data, error } = await cargarTabla({ page: p, estado, version, etapa, busqueda })
    if (error) {
      setTablaErr(error)
      setTabla(null)
      setTablaLoading(false)
      return
    }
    setTabla(data)
    setTablaLoading(false)
  }

  useEffect(() => {
    void loadResumen()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void loadTabla()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, fEstado, fVersion, fEtapa, fBusqueda])

  const paginas = useMemo(() => totalPaginas(tabla), [tabla])
  const donutEtapa = useMemo(() => donutPorEtapa(resumen), [resumen])
  const donutVersion = useMemo(() => donutPorVersion(resumen), [resumen])
  const barrasTipo = useMemo(() => barrasPorTipo(resumen), [resumen])

  return {
    axis,
    grid,
    tipBg,
    tipFg,
    resumen,
    resumenErr,
    resumenLoading,
    loadResumen,
    tabla,
    tablaErr,
    tablaLoading,
    loadTabla,
    page,
    setPage,
    fEstado,
    setFEstado,
    fVersion,
    setFVersion,
    fEtapa,
    setFEtapa,
    fBusqueda,
    setFBusqueda,
    busquedaInput,
    setBusquedaInput,
    detalle,
    setDetalle,
    paginas,
    donutEtapa,
    donutVersion,
    barrasTipo,
  }
}

import { useEffect, useMemo, useState } from 'react'
import type { Contrato, DashboardResumen } from '../../types'
import { useTheme } from '../../lib/theme'
import {
  cargarDashboardBase,
  cargarCapaSemantica,
  cargarKpisConversion,
} from './api'
import {
  barrasCategorias,
  comparacionCategorias,
  contratosPorTipoEntidad,
  filtrarOportunidades,
  lineasParaGrafica,
  RUBRO_LABEL,
  resumenPorMes,
  resumenPorObjeto,
  seriesPorCategoria,
  tendenciaPct,
  topEntidades as calcularTopEntidades,
  type CapaSemantica,
  type ContratoEstado,
  type KpisConversion,
  type KpisConversionRubro,
  type RubroAgg,
  type UrgFilter,
  type VistaLista,
} from './model'

export const PIE_COLORS = ['#14B8A6', '#6366f1', '#f59e0b', '#ef4444']
export const LINE_COLORS = ['#14B8A6', '#8b5cf6', '#f59e0b', '#3b82f6', '#ef4444']
export const RUBRO_COLORS: Record<string, string> = {
  nucleo: '#14B8A6',
  adyacente: '#8b5cf6',
  oportunista: '#f59e0b',
  marginal: '#64748b',
  sin_clasificar: '#94a3b8',
}

export type Tab = 'oportunidades' | 'resumen' | 'tendencias'
const EMPTY_CONTRATOS: ContratoEstado[] = []

export function useDashboard() {
  const { theme } = useTheme()
  const axis = theme === 'dark' ? '#94a3b8' : '#64748b'
  const grid = theme === 'dark' ? '#1e293b' : '#e2e8f0'
  const tipBg = theme === 'dark' ? '#0f172a' : '#fff'
  const tipFg = theme === 'dark' ? '#e2e8f0' : '#0f172a'

  const [tab, setTab] = useState<Tab>('oportunidades')
  const [resumen, setResumen] = useState<DashboardResumen[]>([])
  const [capa, setCapa] = useState<CapaSemantica | null>(null)
  const [conversion, setConversion] = useState<{
    global: KpisConversion
    rubros: KpisConversionRubro[]
  } | null>(null)
  const [recientes, setRecientes] = useState<Contrato[]>([])
  const [ultima, setUltima] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [catChip, setCatChip] = useState<string | null>(null)
  const [urg, setUrg] = useState<UrgFilter>('todos')
  const [vista, setVista] = useState<VistaLista>('postulable')
  const [narrow, setNarrow] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const apply = () => setNarrow(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [capaRes, baseRes, convRes] = await Promise.all([
          cargarCapaSemantica(),
          cargarDashboardBase(),
          cargarKpisConversion(),
        ])
        if (cancelled) return
        setCapa(capaRes)
        setConversion(convRes)
        setResumen(baseRes.resumen)
        setRecientes(baseRes.recientes)
        setUltima(baseRes.ultima)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudo cargar el dashboard')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const kpis = capa?.kpis
  const negocio = capa?.negocio
  const postulables = capa?.postulables ?? EMPTY_CONTRATOS
  const cerrados = capa?.cerrados ?? EMPTY_CONTRATOS

  const urgentes = useMemo(() => ({
    hoy: postulables.filter((c) => c.cierra_hoy),
    manana: postulables.filter((c) => c.cierra_manana),
    semana: postulables.filter((c) => c.cierra_semana),
  }), [postulables])

  const catBars = useMemo(() => barrasCategorias(kpis), [kpis])

  const tendenciaAltas = tendenciaPct(kpis?.altas_it_7d ?? 0, kpis?.altas_it_7d_prev ?? 0)

  const porMes = useMemo(() => resumenPorMes(resumen), [resumen])

  const porObjeto = useMemo(() => resumenPorObjeto(resumen), [resumen])

  const topEntidades = useMemo(() => calcularTopEntidades(postulables), [postulables])

  const porTipoEnt = useMemo(() => contratosPorTipoEntidad(postulables), [postulables])

  const topCats = useMemo(() => catBars.slice(0, 5).map((c) => c.id), [catBars])

  const seriesIT = useMemo(() => seriesPorCategoria(resumen, topCats), [resumen, topCats])

  const cmpMes = useMemo(() => comparacionCategorias(catBars, resumen, seriesIT), [catBars, resumen, seriesIT])

  const baseLista: ContratoEstado[] = vista === 'postulable' ? postulables : cerrados

  const listaOpp = useMemo(
    () => filtrarOportunidades(baseLista, { categoria: catChip, urgencia: urg, vista }),
    [baseLista, catChip, urg, vista],
  )

  const chartRubro = (negocio?.por_rubro ?? []).map((r) => ({
    name: RUBRO_LABEL[r.rubro as RubroAgg] ?? r.rubro,
    value: r.total,
    rubro: r.rubro,
  }))
  const chartLinea = lineasParaGrafica(negocio?.por_linea ?? [])

  const tip = { background: tipBg, border: `1px solid ${grid}`, color: tipFg, fontSize: 12 }

  return {
    axis,
    grid,
    tip,
    narrow,
    tab,
    setTab,
    catChip,
    setCatChip,
    urg,
    setUrg,
    vista,
    setVista,
    loading,
    error,
    kpis,
    negocio,
    postulables,
    cerrados,
    urgentes,
    catBars,
    tendenciaAltas,
    conversion,
    chartRubro,
    chartLinea,
    porMes,
    porObjeto,
    topEntidades,
    porTipoEnt,
    topCats,
    seriesIT,
    cmpMes,
    listaOpp,
    recientes,
    ultima,
  }
}

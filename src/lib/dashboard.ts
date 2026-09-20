import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import type { Contrato, DashboardResumen } from '../types'
import { labelCat, tipoEntidad } from './cats'
import { useTheme } from './theme'
import { cierraEn } from './format'
import {
  cargarCapaSemantica,
  cargarKpisConversion,
  RUBRO_LABEL,
  tendenciaPct,
  type CapaSemantica,
  type ContratoEstado,
  type KpisConversion,
  type KpisConversionRubro,
  type RubroAgg,
} from './capaSemantica'

export const PIE_COLORS = ['#14B8A6', '#6366f1', '#f59e0b', '#ef4444']
export const LINE_COLORS = ['#14B8A6', '#8b5cf6', '#f59e0b', '#3b82f6', '#ef4444']
export const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
export const RUBRO_COLORS: Record<string, string> = {
  nucleo: '#14B8A6',
  adyacente: '#8b5cf6',
  oportunista: '#f59e0b',
  marginal: '#64748b',
  sin_clasificar: '#94a3b8',
}

export type Tab = 'oportunidades' | 'resumen' | 'tendencias'
export type UrgFilter = 'todos' | 'hoy' | 'semana' | 'mes'
export type VistaLista = 'postulable' | 'cerrados'

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
        const [capaRes, rResumen, rRecientes, rUltima, convRes] = await Promise.all([
          cargarCapaSemantica(),
          supabase.from('dashboard_resumen').select('*'),
          supabase.from('v_contratos').select('*').order('fecha_publica', { ascending: false }).limit(10),
          supabase.from('v_contratos').select('fecha_publica').order('fecha_publica', { ascending: false }).limit(1),
          cargarKpisConversion(),
        ])
        if (cancelled) return
        if (rResumen.error) throw new Error(rResumen.error.message)
        setCapa(capaRes)
        setConversion(convRes)
        setResumen((rResumen.data ?? []) as DashboardResumen[])
        setRecientes((rRecientes.data ?? []) as Contrato[])
        setUltima(rUltima.data?.[0]?.fecha_publica ?? null)
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
  const postulables = capa?.postulables ?? []
  const cerrados = capa?.cerrados ?? []

  const urgentes = useMemo(() => ({
    hoy: postulables.filter((c) => c.cierra_hoy),
    manana: postulables.filter((c) => c.cierra_manana),
    semana: postulables.filter((c) => c.cierra_semana),
  }), [postulables])

  const catBars = useMemo(() => {
    return (kpis?.por_linea ?? [])
      .map((r) => ({ id: r.linea, label: labelCat(r.linea) || r.linea, total: r.total }))
      .slice(0, 6)
  }, [kpis])

  const tendenciaAltas = tendenciaPct(kpis?.altas_it_7d ?? 0, kpis?.altas_it_7d_prev ?? 0)

  const porMes = useMemo(() => {
    const map = new Array(12).fill(0)
    for (const r of resumen) {
      const m = new Date(r.mes).getUTCMonth()
      if (!Number.isNaN(m)) map[m] += r.total
    }
    return map.map((total, i) => ({ mes: MESES[i], total }))
  }, [resumen])

  const porObjeto = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of resumen) map.set(r.objeto || '—', (map.get(r.objeto || '—') ?? 0) + r.total)
    const arr = [...map.entries()].map(([name, value]) => ({ name, value }))
    const sum = arr.reduce((s, x) => s + x.value, 0) || 1
    return arr.map((x) => ({ ...x, pct: Math.round((x.value / sum) * 100) }))
  }, [resumen])

  const topEntidades = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of postulables) map.set(c.entidad || '—', (map.get(c.entidad || '—') ?? 0) + 1)
    return [...map.entries()].map(([name, total]) => ({ name: name.slice(0, 42), total }))
      .sort((a, b) => b.total - a.total).slice(0, 10)
  }, [postulables])

  const porTipoEnt = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of postulables) {
      const t = tipoEntidad(c.entidad)
      map.set(t, (map.get(t) ?? 0) + 1)
    }
    return [...map.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total)
  }, [postulables])

  const topCats = useMemo(() => catBars.slice(0, 5).map((c) => c.id), [catBars])

  const seriesIT = useMemo(() => {
    const months = porMes.map((m) => m.mes)
    const rows = months.map((mes) => {
      const row: Record<string, string | number> = { mes }
      for (const cat of topCats) row[cat] = 0
      return row
    })
    for (const r of resumen) {
      if (!r.categoria_it || !topCats.includes(r.categoria_it)) continue
      const m = new Date(r.mes).getUTCMonth()
      if (!Number.isNaN(m)) rows[m][r.categoria_it] = Number(rows[m][r.categoria_it] ?? 0) + r.total
    }
    return rows
  }, [resumen, porMes, topCats])

  const cmpMes = useMemo(() => {
    const nowM = new Date().getUTCMonth()
    const prev = nowM === 0 ? 11 : nowM - 1
    return catBars.map((c) => {
      let cur = 0
      let ant = 0
      for (const r of resumen) {
        if (r.categoria_it !== c.id) continue
        const m = new Date(r.mes).getUTCMonth()
        if (m === nowM) cur += r.total
        if (m === prev) ant += r.total
      }
      const pct = ant === 0 ? (cur > 0 ? 100 : 0) : Math.round(((cur - ant) / ant) * 100)
      const spark = seriesIT.map((row) => Number(row[c.id] ?? 0))
      return { ...c, cur, ant, pct, spark }
    })
  }, [catBars, resumen, seriesIT])

  const baseLista: ContratoEstado[] = vista === 'postulable' ? postulables : cerrados

  const listaOpp = useMemo(() => {
    return baseLista.filter((c) => {
      if (catChip && c.categoria_it !== catChip) return false
      if (vista === 'cerrados') return true
      if (urg === 'hoy') return c.cierra_hoy || c.cierra_manana
      if (urg === 'semana') return c.cierra_7d
      if (urg === 'mes') {
        const u = cierraEn(c.fecha_fin_cotizacion)
        return u.days != null && u.days >= 0 && u.days <= 30
      }
      return true
    })
  }, [baseLista, catChip, urg, vista])

  const chartRubro = (negocio?.por_rubro ?? []).map((r) => ({
    name: RUBRO_LABEL[r.rubro as RubroAgg] ?? r.rubro,
    value: r.total,
    rubro: r.rubro,
  }))
  const chartLinea = (negocio?.por_linea ?? []).map((r) => ({
    name: labelCat(r.linea) || r.linea,
    value: r.total,
  }))

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

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../lib/auth'
import { useTheme } from '../../lib/theme'
import {
  barrasComponente,
  donutCosto,
  estadoTrigger,
  filasKv,
  isoDiasAtras,
  localIso,
  totalPaginasSinIntento,
  type AdminStats,
  type SinIntentoData,
  type UsoIaStats,
} from './model'
import {
  cargarAdminStats,
  cargarCubso,
  cargarModelos,
  cargarSinIntento,
  cargarUsoIa,
  type CubsoVersion,
} from './api'

export function useObservabilidad() {
  const { session } = useAuth()
  const { theme } = useTheme()
  const axis = theme === 'dark' ? '#94a3b8' : '#64748b'
  const grid = theme === 'dark' ? '#1e293b' : '#e2e8f0'
  const tipBg = theme === 'dark' ? '#0f172a' : '#fff'
  const tipFg = theme === 'dark' ? '#e2e8f0' : '#0f172a'

  const [stats, setStats] = useState<AdminStats | null>(null)
  const [statsErr, setStatsErr] = useState<string | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  const [cubso, setCubso] = useState<CubsoVersion | null>(null)
  const [cubsoErr, setCubsoErr] = useState<string | null>(null)
  const [cubsoLoading, setCubsoLoading] = useState(true)

  // Consumo de IA
  const [uso, setUso] = useState<UsoIaStats | null>(null)
  const [usoErr, setUsoErr] = useState<string | null>(null)
  const [usoLoading, setUsoLoading] = useState(true)
  const [usoDesde, setUsoDesde] = useState(() => isoDiasAtras(30))
  const [usoHasta, setUsoHasta] = useState(() => localIso(new Date()))
  const [modeloFiltro, setModeloFiltro] = useState('')
  const [compFiltro, setCompFiltro] = useState('')
  const [modelos, setModelos] = useState<string[]>([])

  // Postulables sin intento
  const [sinIntento, setSinIntento] = useState<SinIntentoData | null>(null)
  const [sinIntentoErr, setSinIntentoErr] = useState<string | null>(null)
  const [sinIntentoLoading, setSinIntentoLoading] = useState(true)
  const [sinPage, setSinPage] = useState(0)
  const [sinSoloTi, setSinSoloTi] = useState(false)

  async function loadStats() {
    setStatsLoading(true)
    setStatsErr(null)
    const { stats: data, error } = await cargarAdminStats(session?.access_token)
    setStats(data)
    setStatsErr(error)
    setStatsLoading(false)
  }

  async function loadCubso() {
    setCubsoLoading(true)
    setCubsoErr(null)
    const { data, error } = await cargarCubso()
    setCubso(data)
    setCubsoErr(error)
    setCubsoLoading(false)
  }

  async function loadModelos() {
    setModelos(await cargarModelos())
  }

  async function loadUso() {
    setUsoLoading(true)
    setUsoErr(null)
    const { data, error } = await cargarUsoIa({
      desde: usoDesde,
      hasta: usoHasta,
      modelo: modeloFiltro,
      componente: compFiltro,
    })
    setUso(data)
    setUsoErr(error)
    setUsoLoading(false)
  }

  async function loadSinIntento(page = sinPage, soloTi = sinSoloTi) {
    setSinIntentoLoading(true)
    setSinIntentoErr(null)
    const { data, error } = await cargarSinIntento(page, soloTi)
    setSinIntento(data)
    setSinIntentoErr(error)
    setSinIntentoLoading(false)
  }

  useEffect(() => {
    void loadStats()
    void loadCubso()
    void loadModelos()
    // session.access_token basta; no re-fetch en cada render del objeto session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token])

  useEffect(() => {
    void loadUso()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token, usoDesde, usoHasta, modeloFiltro, compFiltro])

  useEffect(() => {
    void loadSinIntento()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token, sinPage, sinSoloTi])

  const trigger = estadoTrigger(stats)
  const kvRows = useMemo(() => filasKv(stats), [stats])
  const compBars = useMemo(() => barrasComponente(uso), [uso])
  const donut = useMemo(() => donutCosto(uso), [uso])
  const totalPaginas = totalPaginasSinIntento(sinIntento)

  return {
    axis,
    grid,
    tipBg,
    tipFg,
    stats,
    statsErr,
    statsLoading,
    loadStats,
    cubso,
    cubsoErr,
    cubsoLoading,
    loadCubso,
    uso,
    usoErr,
    usoLoading,
    usoDesde,
    usoHasta,
    modeloFiltro,
    compFiltro,
    modelos,
    setUsoDesde,
    setUsoHasta,
    setModeloFiltro,
    setCompFiltro,
    loadUso,
    sinIntento,
    sinIntentoErr,
    sinIntentoLoading,
    sinPage,
    sinSoloTi,
    setSinPage,
    setSinSoloTi,
    loadSinIntento,
    lastErr: trigger.lastErr,
    lastOk: trigger.lastOk,
    tokenExpira: trigger.tokenExpira,
    diasToken: trigger.diasToken,
    triggerStale: trigger.triggerStale,
    triggerSinOk: trigger.triggerSinOk,
    tokenCls: trigger.tokenCls,
    kvRows,
    compBars,
    donut,
    totalPaginas,
  }
}

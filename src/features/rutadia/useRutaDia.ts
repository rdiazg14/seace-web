import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../lib/auth'
import type { Contrato } from '../../types'
import {
  aplicarFiltros,
  ordenarPostulables,
  puntuar,
  rankingActivo,
  resolverAnalisisParaContrato,
  resumenDiario,
  type FiltroCierre,
  type NivelRubro,
} from './model'
import {
  cargarEstadoPipeline,
  cargarOcultos,
  fetchAnalisisScore,
  fetchUniverso,
  ocultarContrato,
  restaurarContrato,
  type AnalisisFilaScore,
} from './api'

export const TAM_PAGINA_OPCIONES = [10, 20, 50, 100] as const

export function useRutaDia() {
  const { session } = useAuth()
  const [raw, setRaw] = useState<Contrato[]>([])
  const [analisisFilas, setAnalisisFilas] = useState<AnalisisFilaScore[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nivel, setNivel] = useState<NivelRubro | null>(null)
  const [linea, setLinea] = useState<string | null>(null)
  const [cierre, setCierre] = useState<FiltroCierre>('todos')
  const [estadoOtras, setEstadoOtras] = useState<'por_abrir' | 'cerrados'>('cerrados')
  const [paginaPost, setPaginaPost] = useState(1)
  const [paginaOtras, setPaginaOtras] = useState(1)
  const [tamPagina, setTamPagina] = useState(10)
  const [ocultos, setOcultos] = useState<Set<number>>(new Set())
  const [mostrarOcultos, setMostrarOcultos] = useState(false)
  const [detalleId, setDetalleId] = useState<number | null>(null)
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)
  const [actualizado, setActualizado] = useState<string | null>(null)
  const [ingesta, setIngesta] = useState<string | null>(null)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const apply = () => setFiltrosAbiertos(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    let cancelled = false
    void cargarEstadoPipeline().then((fila) => {
      if (!cancelled && fila) {
        setActualizado(fila.ultima_corrida_utc ?? null)
        setIngesta(fila.ultima_ingesta_utc ?? null)
      }
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const rows = await fetchUniverso()
        // Ids del universo (Vigente + En Evaluación). Respuesta ≤ filas en analisis_contrato (~17).
        const analisis = await fetchAnalisisScore(rows.map(c => c.id))
        if (!cancelled) {
          setRaw(rows)
          setAnalisisFilas(analisis)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudo cargar la ruta del día')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  // Proyectos ocultos por el usuario actual.
  useEffect(() => {
    const userId = session?.user.id
    if (!userId) return
    let cancelled = false
    void cargarOcultos(userId).then((ids) => {
      if (!cancelled) setOcultos(ids)
    })
    return () => { cancelled = true }
  }, [session])

  async function ocultar(id: number) {
    const userId = session?.user.id
    if (!userId) return
    setOcultos(prev => new Set(prev).add(id))
    const ok = await ocultarContrato(userId, id)
    if (!ok) {
      setOcultos(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  async function restaurar(id: number) {
    const userId = session?.user.id
    if (!userId) return
    setOcultos(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    const ok = await restaurarContrato(userId, id)
    if (!ok) {
      setOcultos(prev => new Set(prev).add(id))
    }
  }

  function resetPaginas() {
    setPaginaPost(1)
    setPaginaOtras(1)
  }

  const scored = useMemo(
    () => rankingActivo(raw.map(c => {
      const slice = resolverAnalisisParaContrato(c, analisisFilas)
      return puntuar(c, new Date(), slice)
    })),
    [raw, analisisFilas],
  )

  const detalleOportunidad = detalleId != null
    ? scored.find(o => o.contrato.id === detalleId) ?? null
    : null

  // Postulables: todos, ordenados por vencimiento (hoy > mañana > semana > …) y score.
  const postulablesBase = useMemo(
    () => ordenarPostulables(aplicarFiltros(scored, { nivel, linea, cierre, estado: 'postulable' })),
    [scored, nivel, linea, cierre],
  )
  const postulablesVisibles = useMemo(
    () => postulablesBase.filter(o => !ocultos.has(o.contrato.id)),
    [postulablesBase, ocultos],
  )
  const ocultosList = useMemo(
    () => postulablesBase.filter(o => ocultos.has(o.contrato.id)),
    [postulablesBase, ocultos],
  )
  const otras = useMemo(
    () => aplicarFiltros(scored, { nivel, linea, cierre: 'todos', estado: estadoOtras }),
    [scored, nivel, linea, estadoOtras],
  )

  const totalPagPost = Math.max(1, Math.ceil(postulablesVisibles.length / tamPagina))
  const pagPost = Math.min(paginaPost, totalPagPost)
  const postPaginados = postulablesVisibles.slice((pagPost - 1) * tamPagina, pagPost * tamPagina)

  const totalPagOtras = Math.max(1, Math.ceil(otras.length / tamPagina))
  const pagOtras = Math.min(paginaOtras, totalPagOtras)
  const otrasPaginados = otras.slice((pagOtras - 1) * tamPagina, pagOtras * tamPagina)

  const kpis = useMemo(() => resumenDiario(scored), [scored])

  const filtrosActivos = (nivel ? 1 : 0) + (linea ? 1 : 0) + (cierre !== 'todos' ? 1 : 0)

  return {
    loading,
    error,
    nivel,
    setNivel,
    linea,
    setLinea,
    cierre,
    setCierre,
    estadoOtras,
    setEstadoOtras,
    tamPagina,
    setTamPagina,
    ocultos,
    mostrarOcultos,
    setMostrarOcultos,
    filtrosAbiertos,
    setFiltrosAbiertos,
    filtrosActivos,
    actualizado,
    ingesta,
    scored,
    detalleOportunidad,
    setDetalleId,
    postulablesVisibles,
    ocultosList,
    otras,
    pagPost,
    setPaginaPost,
    totalPagPost,
    postPaginados,
    pagOtras,
    setPaginaOtras,
    totalPagOtras,
    otrasPaginados,
    kpis,
    resetPaginas,
    ocultar,
    restaurar,
  }
}

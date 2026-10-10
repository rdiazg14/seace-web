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

// Universo + análisis recorren varias páginas; las lecturas pequeñas usan el plazo del perfil.
export const PLAZO_UNIVERSO_MS = 45000
export const PLAZO_LECTURA_MS = 15000
export const REFRESCO_RELOJ_MS = 60000

/** Carga con transporte cancelable. `cerrar()` (cleanup del efecto) la vuelve
 *  obsoleta: su resultado ya no debe tocar estado. Si vence el plazo sigue
 *  siendo la carga actual y debe mostrar un error recuperable. */
function iniciarCarga(plazoMs: number) {
  const controller = new AbortController()
  let obsoleta = false
  let vencida = false
  const timer = setTimeout(() => {
    vencida = true
    controller.abort()
  }, plazoMs)
  return {
    signal: controller.signal,
    exigirVigente: () => {
      if (controller.signal.aborted) throw new DOMException('Carga cancelada', 'AbortError')
    },
    obsoleta: () => obsoleta,
    vencida: () => vencida,
    terminar: () => clearTimeout(timer),
    cerrar: () => {
      obsoleta = true
      clearTimeout(timer)
      controller.abort()
    },
  }
}

type OcultosCarga = {
  userId: string | null
  estado: 'cargando' | 'listo' | 'error'
  ids: Set<number>
}

const SIN_OCULTOS: Set<number> = new Set()

export function useRutaDia() {
  const { session } = useAuth()
  // Identidad estable: un objeto session nuevo de la misma cuenta no recarga nada.
  const userId = session?.user.id ?? null
  const [raw, setRaw] = useState<Contrato[]>([])
  const [analisisFilas, setAnalisisFilas] = useState<AnalisisFilaScore[]>([])
  const [cargandoUniverso, setCargandoUniverso] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [intentoUniverso, setIntentoUniverso] = useState(0)
  const [intentoOcultos, setIntentoOcultos] = useState(0)
  const [intentoPipeline, setIntentoPipeline] = useState(0)
  const [pipelineError, setPipelineError] = useState(false)
  const [universoIncompleto, setUniversoIncompleto] = useState<{ cargados: number; total: number | null } | null>(null)
  const [analisisIncompleto, setAnalisisIncompleto] = useState(false)
  // Reloj de la pantalla: vigencia, urgencia y KPIs dependen de la fecha y se
  // recalculan aunque Diario quede abierto al cambiar de día o de ventana.
  const [ahora, setAhora] = useState(() => new Date())
  const [nivel, setNivel] = useState<NivelRubro | null>(null)
  const [linea, setLinea] = useState<string | null>(null)
  const [cierre, setCierre] = useState<FiltroCierre>('todos')
  const [estadoOtras, setEstadoOtras] = useState<'por_abrir' | 'cerrados'>('cerrados')
  const [paginaPost, setPaginaPost] = useState(1)
  const [paginaOtras, setPaginaOtras] = useState(1)
  const [tamPagina, setTamPagina] = useState(10)
  const [ocultosCarga, setOcultosCarga] = useState<OcultosCarga>({ userId: null, estado: 'listo', ids: SIN_OCULTOS })
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
    const refrescar = () => {
      if (document.visibilityState !== 'hidden') setAhora(new Date())
    }
    const timer = setInterval(refrescar, REFRESCO_RELOJ_MS)
    document.addEventListener('visibilitychange', refrescar)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', refrescar)
    }
  }, [])

  // Informativo: su fallo se señala aparte y nunca bloquea la lista.
  useEffect(() => {
    const carga = iniciarCarga(PLAZO_LECTURA_MS)
    setPipelineError(false)
    void cargarEstadoPipeline(carga.signal).then((fila) => {
      carga.exigirVigente()
      setActualizado(fila?.ultima_corrida_utc ?? null)
      setIngesta(fila?.ultima_ingesta_utc ?? null)
    }).catch(() => {
      if (!carga.obsoleta()) setPipelineError(true)
    }).finally(() => carga.terminar())
    return () => carga.cerrar()
  }, [intentoPipeline])

  useEffect(() => {
    const carga = iniciarCarga(PLAZO_UNIVERSO_MS)
    async function load() {
      setCargandoUniverso(true)
      setError(null)
      try {
        const universo = await fetchUniverso(carga.signal)
        // Tras salir de la pantalla o vencer el plazo no se inicia el análisis.
        carga.exigirVigente()
        // Ids del universo (Vigente + En Evaluación).
        const analisis = await fetchAnalisisScore(universo.filas.map(c => c.id), carga.signal)
        carga.exigirVigente()
        setRaw(universo.filas)
        setAnalisisFilas(analisis.filas)
        setUniversoIncompleto(universo.completo ? null : { cargados: universo.filas.length, total: universo.total })
        setAnalisisIncompleto(!analisis.completo)
        setAhora(new Date())
      } catch (e) {
        if (carga.obsoleta()) return
        if (carga.vencida()) setError('La carga tardó demasiado. Reintenta en unos momentos.')
        else setError(e instanceof Error ? e.message : 'No se pudo cargar la ruta del día')
      } finally {
        carga.terminar()
        if (!carga.obsoleta()) setCargandoUniverso(false)
      }
    }
    void load()
    return () => carga.cerrar()
  }, [intentoUniverso])

  // Proyectos ocultos por el usuario actual.
  useEffect(() => {
    if (!userId) return
    const carga = iniciarCarga(PLAZO_LECTURA_MS)
    setOcultosCarga({ userId, estado: 'cargando', ids: SIN_OCULTOS })
    void cargarOcultos(userId, carga.signal).then((ids) => {
      carga.exigirVigente()
      setOcultosCarga({ userId, estado: 'listo', ids })
    }).catch(() => {
      // Se conservan los ids que el usuario haya marcado mientras tanto.
      if (!carga.obsoleta()) setOcultosCarga(prev => prev.userId === userId ? { ...prev, estado: 'error' } : prev)
    }).finally(() => carga.terminar())
    return () => carga.cerrar()
  }, [userId, intentoOcultos])

  // Las preferencias de otra cuenta (o aún no pedidas) nunca se aplican a la actual.
  const ocultosVigentes: OcultosCarga = !userId
    ? { userId: null, estado: 'listo', ids: SIN_OCULTOS }
    : ocultosCarga.userId === userId
      ? ocultosCarga
      : { userId, estado: 'cargando', ids: SIN_OCULTOS }
  const ocultos = ocultosVigentes.ids
  const loading = cargandoUniverso || ocultosVigentes.estado === 'cargando'

  function mutarOcultos(dueno: string, cambio: (ids: Set<number>) => void) {
    setOcultosCarga(prev => {
      if (prev.userId !== dueno) return prev
      const ids = new Set(prev.ids)
      cambio(ids)
      return { ...prev, ids }
    })
  }

  async function ocultar(id: number) {
    if (!userId) return
    mutarOcultos(userId, ids => ids.add(id))
    const ok = await ocultarContrato(userId, id)
    if (!ok) mutarOcultos(userId, ids => ids.delete(id))
  }

  async function restaurar(id: number) {
    if (!userId) return
    mutarOcultos(userId, ids => ids.delete(id))
    const ok = await restaurarContrato(userId, id)
    if (!ok) mutarOcultos(userId, ids => ids.add(id))
  }

  function resetPaginas() {
    setPaginaPost(1)
    setPaginaOtras(1)
  }

  const scored = useMemo(
    () => rankingActivo(raw.map(c => {
      const slice = resolverAnalisisParaContrato(c, analisisFilas)
      return puntuar(c, ahora, slice)
    })),
    [raw, analisisFilas, ahora],
  )

  const detalleOportunidad = detalleId != null
    ? scored.find(o => o.contrato.id === detalleId) ?? null
    : null

  // Postulables: todos, ordenados por vencimiento (hoy > mañana > semana > …) y score.
  const postulablesBase = useMemo(
    () => ordenarPostulables(aplicarFiltros(scored, { nivel, linea, cierre, estado: 'postulable', ahora }), ahora),
    [scored, nivel, linea, cierre, ahora],
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
    () => aplicarFiltros(scored, { nivel, linea, cierre: 'todos', estado: estadoOtras, ahora }),
    [scored, nivel, linea, estadoOtras, ahora],
  )

  const totalPagPost = Math.max(1, Math.ceil(postulablesVisibles.length / tamPagina))
  const pagPost = Math.min(paginaPost, totalPagPost)
  const postPaginados = postulablesVisibles.slice((pagPost - 1) * tamPagina, pagPost * tamPagina)

  const totalPagOtras = Math.max(1, Math.ceil(otras.length / tamPagina))
  const pagOtras = Math.min(paginaOtras, totalPagOtras)
  const otrasPaginados = otras.slice((pagOtras - 1) * tamPagina, pagOtras * tamPagina)

  const kpis = useMemo(() => resumenDiario(scored, ahora), [scored, ahora])

  const filtrosActivos = (nivel ? 1 : 0) + (linea ? 1 : 0) + (cierre !== 'todos' ? 1 : 0)

  return {
    loading,
    error,
    recargar: () => setIntentoUniverso(n => n + 1),
    ocultosError: ocultosVigentes.estado === 'error',
    reintentarOcultos: () => setIntentoOcultos(n => n + 1),
    pipelineError,
    reintentarPipeline: () => setIntentoPipeline(n => n + 1),
    universoIncompleto,
    analisisIncompleto,
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

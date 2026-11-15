import { useCallback, useEffect, useMemo, useState } from 'react'
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
  type Oportunidad,
} from './model'
import {
  cargarEstadoPipeline,
  cargarOcultos,
  fetchAnalisisScore,
  fetchConvocatorias,
  fetchUniverso,
  ocultarContrato,
  restaurarContrato,
  type AnalisisFilaScore,
} from './api'
import {
  agruparConvocatorias,
  contarConvocatorias,
  cumpleFiltroConvocatoria,
  type FiltroConvocatoria,
  type ResumenConvocatorias,
} from './convocatorias'
import { armarMenuTemas, cumpleTema, SIN_TEMA, temaDe, type SeleccionTema, type TemaContrato } from './temas'

const SIN_CONVOCATORIAS: Map<number, ResumenConvocatorias> = new Map()

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
  // Mientras no llega la lectura no se sabe la fecha: la cabecera no debe decir "sin dato".
  const [pipelineCargando, setPipelineCargando] = useState(true)
  const [universoIncompleto, setUniversoIncompleto] = useState<{ cargados: number; total: number | null } | null>(null)
  const [analisisIncompleto, setAnalisisIncompleto] = useState(false)
  // Informativo: sin este dato la lista funciona igual, solo no muestra reconvocatorias.
  const [convocatorias, setConvocatorias] = useState(SIN_CONVOCATORIAS)
  const [convocatoriasError, setConvocatoriasError] = useState(false)
  // Reloj de la pantalla: vigencia, urgencia y KPIs dependen de la fecha y se
  // recalculan aunque Diario quede abierto al cambiar de día o de ventana.
  const [ahora, setAhora] = useState(() => new Date())
  const [nivel, setNivel] = useState<NivelRubro | null>(null)
  const [tema, setTema] = useState<SeleccionTema>(SIN_TEMA)
  const [cierre, setCierre] = useState<FiltroCierre>('todos')
  const [convocatoria, setConvocatoria] = useState<FiltroConvocatoria>('todas')
  const [estadoOtras, setEstadoOtras] = useState<'por_abrir' | 'cerrados'>('cerrados')
  const [paginaPost, setPaginaPost] = useState(1)
  const [paginaOtras, setPaginaOtras] = useState(1)
  const [tamPagina, setTamPagina] = useState(10)
  const [ocultosCarga, setOcultosCarga] = useState<OcultosCarga>({ userId: null, estado: 'listo', ids: SIN_OCULTOS })
  // Fallo de la última escritura de ocultos, atado a la cuenta que la hizo.
  const [accionError, setAccionError] = useState<{ userId: string; texto: string } | null>(null)
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
    setPipelineCargando(true)
    void cargarEstadoPipeline(carga.signal).then((fila) => {
      carga.exigirVigente()
      setActualizado(fila?.ultima_corrida_utc ?? null)
      setIngesta(fila?.ultima_ingesta_utc ?? null)
    }).catch(() => {
      if (!carga.obsoleta()) setPipelineError(true)
    }).finally(() => {
      carga.terminar()
      if (!carga.obsoleta()) setPipelineCargando(false)
    })
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
        const ids = universo.filas.map(c => c.id)
        // En paralelo con el análisis; su fallo no bloquea la lista.
        const convocatoriasLeidas = fetchConvocatorias(ids, carga.signal).catch(() => null)
        const analisis = await fetchAnalisisScore(ids, carga.signal)
        const historial = await convocatoriasLeidas
        carga.exigirVigente()
        setRaw(universo.filas)
        setAnalisisFilas(analisis.filas)
        setConvocatorias(historial ? agruparConvocatorias(historial.filas) : SIN_CONVOCATORIAS)
        setConvocatoriasError(historial == null || !historial.completo)
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

  /** Escritura con plazo: un fallo, un corte o una espera excesiva devuelven false. */
  async function escribir(operacion: (signal: AbortSignal) => Promise<boolean>): Promise<boolean> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), PLAZO_LECTURA_MS)
    try {
      return await operacion(controller.signal)
    } catch {
      return false
    } finally {
      clearTimeout(timer)
    }
  }

  async function ocultar(id: number) {
    if (!userId) return
    const dueno = userId
    setAccionError(null)
    mutarOcultos(dueno, ids => ids.add(id))
    if (await escribir(signal => ocultarContrato(dueno, id, signal))) return
    mutarOcultos(dueno, ids => ids.delete(id))
    setAccionError({ userId: dueno, texto: 'No pudimos ocultar el proyecto; sigue visible. Inténtalo de nuevo.' })
  }

  async function restaurar(id: number) {
    if (!userId) return
    const dueno = userId
    setAccionError(null)
    mutarOcultos(dueno, ids => ids.delete(id))
    if (await escribir(signal => restaurarContrato(dueno, id, signal))) return
    mutarOcultos(dueno, ids => ids.add(id))
    setAccionError({ userId: dueno, texto: 'No pudimos restaurar el proyecto; sigue oculto. Inténtalo de nuevo.' })
  }

  function resetPaginas() {
    setPaginaPost(1)
    setPaginaOtras(1)
  }

  const scored = useMemo(
    () => rankingActivo(raw.map(c => {
      const slice = resolverAnalisisParaContrato(c, analisisFilas)
      return puntuar(c, ahora, slice, convocatorias.get(c.id) ?? null)
    })),
    [raw, analisisFilas, ahora, convocatorias],
  )

  const detalleOportunidad = detalleId != null
    ? scored.find(o => o.contrato.id === detalleId) ?? null
    : null

  // Con el historial ausente o incompleto el filtro escondería procesos que sí
  // son reconvocatorias: no se ofrece ni se aplica.
  const filtroConvocatoria: FiltroConvocatoria = convocatoriasError ? 'todas' : convocatoria

  // El tema depende solo del proceso: no se recalcula con el reloj.
  const temas = useMemo(
    () => new Map<number, TemaContrato>(raw.map(c => [c.id, temaDe(c)])),
    [raw],
  )
  const pasaTema = useCallback((o: Oportunidad) => {
    const t = temas.get(o.contrato.id)
    return t ? cumpleTema(t, tema) : !tema.linea
  }, [temas, tema])
  const pasaConvocatoria = useCallback(
    (o: Oportunidad) => cumpleFiltroConvocatoria(convocatorias.get(o.contrato.id), filtroConvocatoria),
    [convocatorias, filtroConvocatoria],
  )

  // Postulables por nivel y cierre, ordenados por vencimiento (hoy > mañana > semana > …) y score.
  const postulablesAmplios = useMemo(
    () => ordenarPostulables(aplicarFiltros(scored, { nivel, cierre, estado: 'postulable', ahora }), ahora),
    [scored, nivel, cierre, ahora],
  )
  const visiblesAmplios = useMemo(
    () => postulablesAmplios.filter(o => !ocultos.has(o.contrato.id)),
    [postulablesAmplios, ocultos],
  )
  // Cada filtro cuenta lo que mostraría con los demás filtros puestos, sin los ocultos.
  const menuTemas = useMemo(
    () => armarMenuTemas(
      visiblesAmplios.filter(pasaConvocatoria).flatMap(o => temas.get(o.contrato.id) ?? []),
      tema,
    ),
    [visiblesAmplios, pasaConvocatoria, temas, tema],
  )
  const conteoConvocatorias = useMemo(
    () => contarConvocatorias(visiblesAmplios.filter(pasaTema).map(o => convocatorias.get(o.contrato.id))),
    [visiblesAmplios, pasaTema, convocatorias],
  )
  const postulablesBase = useMemo(
    () => postulablesAmplios.filter(o => pasaTema(o) && pasaConvocatoria(o)),
    [postulablesAmplios, pasaTema, pasaConvocatoria],
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
    () => aplicarFiltros(scored, { nivel, cierre: 'todos', estado: estadoOtras, ahora })
      .filter(o => pasaTema(o) && pasaConvocatoria(o)),
    [scored, nivel, estadoOtras, ahora, pasaTema, pasaConvocatoria],
  )

  const totalPagPost = Math.max(1, Math.ceil(postulablesVisibles.length / tamPagina))
  const pagPost = Math.min(paginaPost, totalPagPost)
  const postPaginados = postulablesVisibles.slice((pagPost - 1) * tamPagina, pagPost * tamPagina)

  const totalPagOtras = Math.max(1, Math.ceil(otras.length / tamPagina))
  const pagOtras = Math.min(paginaOtras, totalPagOtras)
  const otrasPaginados = otras.slice((pagOtras - 1) * tamPagina, pagOtras * tamPagina)

  const kpis = useMemo(() => resumenDiario(scored, ahora), [scored, ahora])

  // Solo los del panel plegable; tema y convocatoria se ven siempre.
  const filtrosActivos = (nivel ? 1 : 0) + (cierre !== 'todos' ? 1 : 0)

  return {
    loading,
    error,
    recargar: () => setIntentoUniverso(n => n + 1),
    ocultosError: ocultosVigentes.estado === 'error',
    reintentarOcultos: () => setIntentoOcultos(n => n + 1),
    accionOcultosError: accionError && accionError.userId === userId ? accionError.texto : null,
    pipelineError,
    pipelineCargando,
    reintentarPipeline: () => setIntentoPipeline(n => n + 1),
    universoIncompleto,
    analisisIncompleto,
    convocatorias,
    convocatoriasError,
    nivel,
    setNivel,
    tema,
    setTema,
    menuTemas,
    cierre,
    setCierre,
    convocatoria: filtroConvocatoria,
    setConvocatoria,
    conteoConvocatorias,
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

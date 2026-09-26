/**
 * Carga de la página de análisis. Lee ficha y análisis persistido; la IA ya
 * corrió una vez en el pipeline batch (analizar_postulables.py), así que al
 * abrir no se dispara /analizar: solo "Analizar ahora" o "Reintentar" lo hacen.
 */

import { useCallback, useEffect, useState } from 'react'
import type { AnalisisResponse } from '../../lib/analisis'
import type { Contrato } from '../../types'
import { leerAnalisisPersistido, leerFicha, solicitarAnalisis } from './api'
import { interpretarAnalizar, pdfHashFicha } from './model'

export function useAnalisisContrato(contratoId: number) {
  const [ficha, setFicha] = useState<Contrato | null>(null)
  const [data, setData] = useState<AnalisisResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [error502, setError502] = useState(false)
  const [sinTdr, setSinTdr] = useState<string | null>(null)
  const [sinAnalisis, setSinAnalisis] = useState(false)

  const reiniciar = () => {
    setLoading(true)
    setError(null)
    setError502(false)
    setSinTdr(null)
    setSinAnalisis(false)
    setData(null)
  }

  const analizarAhora = useCallback(async (signal?: AbortSignal) => {
    if (!Number.isFinite(contratoId) || contratoId <= 0) return
    reiniciar()
    try {
      const respuesta = await solicitarAnalisis(contratoId, signal)
      if (signal?.aborted) return
      const r = interpretarAnalizar(respuesta)
      if (r.kind === 'datos') setData(r.data)
      else if (r.kind === 'error502') setError502(true)
      else if (r.kind === 'sinTdr') setSinTdr(r.mensaje)
      else setError(r.mensaje)
    } catch (e) {
      if ((e as Error).name === 'AbortError' || signal?.aborted) return
      setError(e instanceof Error ? e.message : 'No se pudo analizar')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [contratoId])

  useEffect(() => {
    const ac = new AbortController()
    async function load() {
      if (!Number.isFinite(contratoId) || contratoId <= 0) {
        setError('Contrato inválido')
        setLoading(false)
        return
      }
      reiniciar()
      try {
        const row = await leerFicha(contratoId)
        if (ac.signal.aborted) return
        setFicha(row)
        const persistido = await leerAnalisisPersistido(row.id, pdfHashFicha(row))
        if (ac.signal.aborted) return
        if (persistido) setData(persistido)
        else setSinAnalisis(true)
        setLoading(false)
      } catch (e) {
        if ((e as Error).name === 'AbortError' || ac.signal.aborted) return
        setError(e instanceof Error ? e.message : 'No se pudo analizar')
        if (!ac.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => { ac.abort() }
  }, [contratoId, analizarAhora])

  return { ficha, data, loading, error, error502, sinTdr, sinAnalisis, analizarAhora }
}

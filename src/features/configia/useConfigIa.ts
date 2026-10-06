import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  obtenerAuditoria, obtenerConfig, patchEndpoint, patchModelo, patchProveedor,
  type Cambio, type ConfigData, type Endpoint, type Modelo, type Proveedor,
} from './api'
export { modelosElegibles, resumenCambio } from './model'

export interface ConfigIaState {
  data: ConfigData | null
  cambios: Cambio[]
  loading: boolean
  error: string | null
  ok: string | null
  busy: string | null
  corpus: string
  modelosPorId: Map<string, Modelo>
  proveedoresPorId: Map<string, Proveedor>
  load: () => Promise<void>
  toggleEndpoint: (ep: Endpoint) => Promise<void>
  asignarModelo: (ep: Endpoint, modeloId: string | null) => Promise<void>
  toggleModelo: (m: Modelo) => Promise<void>
  toggleProveedor: (p: Proveedor) => Promise<void>
}

export function useConfigIa(): ConfigIaState {
  const [data, setData] = useState<ConfigData | null>(null)
  const [cambios, setCambios] = useState<Cambio[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [cfg, aud] = await Promise.all([obtenerConfig(), obtenerAuditoria()])
      setData(cfg)
      setCambios(aud)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer la configuración IA.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function mutar(clave: string, mensaje: string, fn: () => Promise<unknown>) {
    if (busy) return
    setBusy(clave)
    setOk(null)
    setError(null)
    try {
      const r = await fn() as { version_config?: number }
      setOk(`${mensaje} (versión ${r.version_config ?? '?'})`)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'La mutación falló.')
    } finally {
      setBusy(null)
    }
  }

  const modelosPorId = useMemo(
    () => new Map((data?.modelos ?? []).map(m => [m.id, m])),
    [data],
  )
  const proveedoresPorId = useMemo(
    () => new Map((data?.proveedores ?? []).map(p => [p.id, p])),
    [data],
  )
  const corpus = useMemo(() => {
    const row = (data?.meta ?? []).find(r => r.clave === 'corpus_embeddings')
    return typeof row?.valor === 'string' ? row.valor : '—'
  }, [data])

  return {
    data, cambios, loading, error, ok, busy, corpus, modelosPorId, proveedoresPorId, load,
    toggleEndpoint: (ep) => mutar(`ep:${ep.endpoint}`, `${ep.endpoint} ${ep.activo ? 'desactivado' : 'activado'}`,
      () => patchEndpoint(ep.endpoint, { activo: !ep.activo })),
    asignarModelo: (ep, modeloId) => mutar(`ep:${ep.endpoint}`, `modelo de ${ep.endpoint} actualizado`,
      () => patchEndpoint(ep.endpoint, { modelo_id: modeloId })),
    toggleModelo: (m) => mutar(`mod:${m.id}`, `modelo ${m.modelo} ${m.activo ? 'desactivado' : 'activado'}`,
      () => patchModelo(m.id, { activo: !m.activo })),
    toggleProveedor: (p) => mutar(`prov:${p.id}`, `proveedor ${p.id} ${p.activo ? 'desactivado' : 'activado'}`,
      () => patchProveedor(p.id, { activo: !p.activo })),
  }
}


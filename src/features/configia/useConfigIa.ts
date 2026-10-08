import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  obtenerAuditoria, obtenerConfig, obtenerFailovers, obtenerInfra, patchEndpoint, patchMeta,
  patchModelo, patchProveedor, registrarSnapshot,
  type Cambio, type ConfigData, type Endpoint, type FailoverEvento, type Modelo,
  type Plataforma, type Proveedor,
} from './api'
export { modelosElegibles, resumenCambio } from './model'

export type ModoFailover = 'auto' | 'manual'

export interface ConfigIaState {
  data: ConfigData | null
  cambios: Cambio[]
  failovers: FailoverEvento[]
  plataformas: Plataforma[]
  loading: boolean
  error: string | null
  ok: string | null
  busy: string | null
  corpus: string
  modoFailover: ModoFailover
  modelosPorId: Map<string, Modelo>
  proveedoresPorId: Map<string, Proveedor>
  load: () => Promise<void>
  toggleEndpoint: (ep: Endpoint) => Promise<void>
  asignarModelo: (ep: Endpoint, modeloId: string | null) => Promise<void>
  reordenarHabilitados: (ep: Endpoint, habilitados: string[]) => Promise<void>
  cambiarModoFailover: (modo: ModoFailover) => Promise<void>
  actualizarSaldo: (p: Proveedor, saldo: number | null) => Promise<void>
  toggleModelo: (m: Modelo) => Promise<void>
  toggleProveedor: (p: Proveedor) => Promise<void>
  registrarCaptura: (plataforma: string, body: Record<string, unknown>) => Promise<void>
}

/** Cadena efectiva visible: [primario] + habilitados (auto: Gemini al final). */
export function cadenaEfectiva(ep: Endpoint, modelosPorId: Map<string, Modelo>, modo: ModoFailover): Modelo[] {
  const out: Modelo[] = []
  const vistos = new Set<string>()
  if (ep.modelo_id) {
    const m = modelosPorId.get(ep.modelo_id)
    if (m) { out.push(m); vistos.add(m.id) }
  }
  for (const id of ep.habilitados ?? []) {
    if (vistos.has(id)) continue
    const m = modelosPorId.get(id)
    if (m) { out.push(m); vistos.add(id) }
  }
  if (modo === 'auto' && out.length > 2 && out[0].proveedor_id !== 'gemini') {
    const sin = out.filter(m => m.proveedor_id !== 'gemini')
    return [...sin, ...out.filter(m => m.proveedor_id === 'gemini')]
  }
  return out
}

export function useConfigIa(): ConfigIaState {
  const [data, setData] = useState<ConfigData | null>(null)
  const [cambios, setCambios] = useState<Cambio[]>([])
  const [failovers, setFailovers] = useState<FailoverEvento[]>([])
  const [plataformas, setPlataformas] = useState<Plataforma[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [cfg, aud, fo, infra] = await Promise.all([obtenerConfig(), obtenerAuditoria(), obtenerFailovers(), obtenerInfra()])
      setData(cfg)
      setCambios(aud)
      setFailovers(fo)
      setPlataformas(infra)
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
  const modoFailover = useMemo<ModoFailover>(() => {
    const row = (data?.meta ?? []).find(r => r.clave === 'modo_failover')
    return row?.valor === 'manual' ? 'manual' : 'auto'
  }, [data])

  return {
    data, cambios, failovers, plataformas, loading, error, ok, busy, corpus, modoFailover,
    modelosPorId, proveedoresPorId, load,
    toggleEndpoint: (ep) => mutar(`ep:${ep.endpoint}`, `${ep.endpoint} ${ep.activo ? 'desactivado' : 'activado'}`,
      () => patchEndpoint(ep.endpoint, { activo: !ep.activo })),
    asignarModelo: (ep, modeloId) => mutar(`ep:${ep.endpoint}`, `modelo de ${ep.endpoint} actualizado`,
      () => patchEndpoint(ep.endpoint, { modelo_id: modeloId })),
    reordenarHabilitados: (ep, habilitados) => mutar(`ep:${ep.endpoint}`, `cadena de ${ep.endpoint} actualizada`,
      () => patchEndpoint(ep.endpoint, { habilitados })),
    cambiarModoFailover: (modo) => mutar('meta:modo_failover', `modo failover → ${modo}`,
      () => patchMeta('modo_failover', modo)),
    actualizarSaldo: (p, saldo) => mutar(`prov:${p.id}`, `saldo inicial de ${p.id} actualizado`,
      () => patchProveedor(p.id, { saldo_inicial_usd: saldo })),
    toggleModelo: (m) => mutar(`mod:${m.id}`, `modelo ${m.modelo} ${m.activo ? 'desactivado' : 'activado'}`,
      () => patchModelo(m.id, { activo: !m.activo })),
    toggleProveedor: (p) => mutar(`prov:${p.id}`, `proveedor ${p.id} ${p.activo ? 'desactivado' : 'activado'}`,
      () => patchProveedor(p.id, { activo: !p.activo })),
    registrarCaptura: (plataforma, body) => mutar(`infra:${plataforma}`, `captura de ${plataforma} registrada`,
      () => registrarSnapshot(plataforma, body)),
  }
}

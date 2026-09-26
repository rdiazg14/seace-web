import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '../../lib/auth'
import { KEYWORD_CATS } from '../../lib/cats'
import {
  catsSugeridas,
  filtrarKeywords,
  siguienteOrden,
  terminoDe,
  UMBRAL_SIMULACION,
  type CandidataRow,
  type ColaRow,
  type FiltroActiva,
  type KeywordRow,
  type SortKey,
} from './model'
import {
  cargarKeywords,
  colaAprobar,
  colaRechazar,
  crearKeyword,
  patchKeyword,
  promoverCandidata,
  simularKeyword,
  type SimularResultado,
} from './api'

export function useKeywords() {
  const { session } = useAuth()
  const token = session?.access_token

  const [rows, setRows] = useState<KeywordRow[]>([])
  const [cands, setCands] = useState<CandidataRow[]>([])
  const [cola, setCola] = useState<ColaRow[]>([])
  const [catElegida, setCatElegida] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const [filtroCat, setFiltroCat] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroActiva, setFiltroActiva] = useState<FiltroActiva>('todas')
  const [sort, setSort] = useState<SortKey>('etiquetas')
  const [sortAsc, setSortAsc] = useState(false)

  const [busyId, setBusyId] = useState<number | null>(null)

  const [kw, setKw] = useState('')
  const [cat, setCat] = useState<string>(KEYWORD_CATS[0])
  const [tipo, setTipo] = useState<'incluye' | 'excluye'>('incluye')
  const [limite, setLimite] = useState(false)
  const [nota, setNota] = useState('')
  const [simForm, setSimForm] = useState<SimularResultado | null>(null)
  const [saving, setSaving] = useState(false)
  const [simulating, setSimulating] = useState(false)

  const [simCand, setSimCand] = useState<{ id: number; r: SimularResultado } | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    const { data, error: err } = await cargarKeywords()
    if (err || !data) {
      setError(err ?? 'Sin datos')
      setLoading(false)
      return
    }
    setRows(data.rows)
    setCands(data.cands)
    setCola(data.cola)
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const visibles = useMemo(
    () => filtrarKeywords(rows, {
      categoria: filtroCat,
      tipo: filtroTipo,
      activa: filtroActiva,
      sort,
      sortAsc,
    }),
    [rows, filtroCat, filtroTipo, filtroActiva, sort, sortAsc],
  )

  function clickSort(k: SortKey) {
    const next = siguienteOrden(sort, sortAsc, k)
    setSort(next.sort)
    setSortAsc(next.sortAsc)
  }

  async function onSimularForm(e?: FormEvent) {
    e?.preventDefault()
    if (!token) return
    setError(null)
    setOk(null)
    setSimulating(true)
    const res = await simularKeyword(token, {
      keyword: kw,
      categoria: cat,
      limite_palabra: limite,
    })
    setSimulating(false)
    if (!res.ok) {
      setError(res.err.mensaje || `HTTP ${res.status}`)
      return
    }
    setSimForm(res.data)
  }

  async function onCrear(e: FormEvent) {
    e.preventDefault()
    if (!token) return
    if (!simForm) {
      setError('Simulá el impacto antes de guardar.')
      return
    }
    if (simForm.etiquetaria > UMBRAL_SIMULACION) {
      const okc = confirm(
        `Esta keyword etiquetaría ${simForm.etiquetaria} contratos sin clasificar (más de 100). ¿Guardar igual? El backfill del corpus no corre desde acá.`,
      )
      if (!okc) return
    }
    setSaving(true)
    setError(null)
    const res = await crearKeyword(token, {
      keyword: kw,
      categoria: cat,
      tipo,
      limite_palabra: limite,
      nota,
    })
    setSaving(false)
    if (!res.ok) {
      setError(res.err.mensaje || `HTTP ${res.status}`)
      return
    }
    setOk('Keyword creada. Afecta altas nuevas; el backfill es del pipeline.')
    setKw('')
    setNota('')
    setSimForm(null)
    await load()
  }

  async function toggleActiva(r: KeywordRow) {
    if (!token) return
    setBusyId(r.id)
    setError(null)
    const res = await patchKeyword(token, r.id, { activa: !r.activa })
    setBusyId(null)
    if (!res.ok) {
      setError(res.err.mensaje || `HTTP ${res.status}`)
      return
    }
    setOk(r.activa ? `Desactivada «${r.keyword}». Reversible.` : `Activada «${r.keyword}».`)
    await load()
  }

  async function onSimularCand(c: CandidataRow) {
    if (!token) return
    setError(null)
    setBusyId(c.id)
    const res = await simularKeyword(token, {
      keyword: terminoDe(c),
      categoria: c.categoria_propuesta,
    })
    setBusyId(null)
    if (!res.ok) {
      setError(res.err.mensaje || `HTTP ${res.status}`)
      return
    }
    setSimCand({ id: c.id, r: res.data })
  }

  async function onPromover(c: CandidataRow) {
    if (!token) return
    if (!simCand || simCand.id !== c.id) {
      setError('Simulá esta candidata antes de promover.')
      return
    }
    if (simCand.r.etiquetaria > UMBRAL_SIMULACION) {
      const okc = confirm(
        `Promover etiquetaría ${simCand.r.etiquetaria} contratos sin clasificar. ¿Seguir? No se reclasifica el corpus desde acá.`,
      )
      if (!okc) return
    }
    setBusyId(c.id)
    const res = await promoverCandidata(token, c.id)
    setBusyId(null)
    if (!res.ok) {
      setError(res.err.mensaje || `HTTP ${res.status}`)
      return
    }
    setOk('Candidata promovida. Vale para altas nuevas; el backfill es aparte.')
    setSimCand(null)
    await load()
  }

  async function onAprobarCola(r: ColaRow) {
    if (!token) return
    const sugeridas = catsSugeridas(r)
    const catSel = catElegida[r.id] || sugeridas[0] || ''
    if (!catSel) {
      setError('Elegí una categoría para aprobar.')
      return
    }
    setBusyId(r.id)
    setError(null)
    const res = await colaAprobar(token, r.id, catSel)
    setBusyId(null)
    if (!res.ok) {
      setError(res.err.mensaje || `HTTP ${res.status}`)
      return
    }
    setOk(`Aprobado ${r.contrato_id} → ${catSel} (capa humano).`)
    await load()
  }

  async function onRechazarCola(r: ColaRow) {
    if (!token) return
    const okc = confirm(
      `¿Rechazar ${r.contrato_id}? Queda sin clasificar y no se vuelve a proponer esa categoría.`,
    )
    if (!okc) return
    setBusyId(r.id)
    setError(null)
    const res = await colaRechazar(token, r.id)
    setBusyId(null)
    if (!res.ok) {
      setError(res.err.mensaje || `HTTP ${res.status}`)
      return
    }
    setOk(`Rechazado ${r.contrato_id}. Ledger C3 para no re-proponer.`)
    await load()
  }

  return {
    rows,
    cands,
    cola,
    catElegida,
    setCatElegida,
    loading,
    error,
    ok,
    filtroCat,
    setFiltroCat,
    filtroTipo,
    setFiltroTipo,
    filtroActiva,
    setFiltroActiva,
    sort,
    sortAsc,
    busyId,
    kw,
    setKw,
    cat,
    setCat,
    tipo,
    setTipo,
    limite,
    setLimite,
    nota,
    setNota,
    simForm,
    setSimForm,
    saving,
    simulating,
    simCand,
    load,
    visibles,
    clickSort,
    onSimularForm,
    onCrear,
    toggleActiva,
    onSimularCand,
    onPromover,
    onAprobarCola,
    onRechazarCola,
  }
}

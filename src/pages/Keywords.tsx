import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { KEYWORD_CATS } from '../lib/cats'
import { Chip, EmptyState, ErrorBox, Skeleton } from '../components/ui'
import {
  colaAprobar,
  colaRechazar,
  crearKeyword,
  patchKeyword,
  promoverCandidata,
  simularKeyword,
  type SimularResultado,
} from '../lib/adminKeywords'

interface KeywordRow {
  id: number
  categoria: string
  keyword: string
  tipo: string
  prioridad: number
  limite_palabra: boolean
  tolera_plural: boolean
  activa: boolean
  nota: string | null
  etiquetas: number
}

interface CandidataRow {
  id: number
  senal: string
  categoria_propuesta: string
  veces_vista: number
  estado: string
  evidencia: Record<string, unknown> | null
}

interface ColaRow {
  id: number
  contrato_id: number
  categoria_p1: string | null
  categoria_p2: string | null
  origen: string | null
  votos: Record<string, string> | null
  estado: string
  nota: string | null
  titulo: string | null
}

function catsSugeridas(r: ColaRow): string[] {
  const out: string[] = []
  for (const c of [r.categoria_p1, r.categoria_p2]) {
    if (c && c !== 'ninguna' && KEYWORD_CATS.includes(c as (typeof KEYWORD_CATS)[number])) {
      out.push(c)
    }
  }
  if (r.votos) {
    for (const v of Object.values(r.votos)) {
      if (v && v !== 'ninguna' && KEYWORD_CATS.includes(v as (typeof KEYWORD_CATS)[number])) {
        out.push(v)
      }
    }
  }
  return [...new Set(out)]
}

type SortKey = 'etiquetas' | 'prioridad' | 'keyword' | 'categoria'

function terminoDe(c: CandidataRow): string {
  const ev = c.evidencia
  const t = ev && typeof ev.termino === 'string' ? ev.termino : ''
  return (t || c.senal || '').trim()
}

function senalOriginal(c: CandidataRow): string {
  const ev = c.evidencia
  const t = ev && typeof ev.senal_original === 'string' ? ev.senal_original : ''
  return (t || c.senal || '').trim()
}

function PanelSimular({
  r,
  umbral,
}: {
  r: SimularResultado
  umbral: boolean
}) {
  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900/50">
      <p>
        Etiquetaría hoy (sin clasificar):{' '}
        <span className="tabular-nums font-medium">{r.etiquetaria.toLocaleString('es-PE')}</span>
      </p>
      <p>
        Ya clasificados que cambiarían de categoría:{' '}
        <span className="tabular-nums font-medium">{r.cambios_categoria.toLocaleString('es-PE')}</span>
      </p>
      <p>
        Hits totales {r.universo.toLocaleString('es-PE')}
        {r.ratio_predictivo != null ? (
          <> · ratio {r.ratio_predictivo.toFixed(2)} (clasificados / total)</>
        ) : null}
      </p>
      {umbral && (
        <p className="text-amber-700 dark:text-amber-400">
          Más de 100 contratos sin clasificar. Confirmá explícitamente antes de guardar.
        </p>
      )}
      {r.ejemplos.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-400">
          {r.ejemplos.map((e) => (
            <li key={e.id}>
              <span className="font-mono">{e.id}</span>
              {' · '}
              {(e.titulo || '—').slice(0, 120)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function Keywords() {
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
  const [filtroActiva, setFiltroActiva] = useState<'todas' | 'activas' | 'inactivas'>('todas')
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
    const [kwRes, cntRes, candRes, colaRes] = await Promise.all([
      supabase
        .from('it_keywords')
        .select('id, categoria, keyword, tipo, prioridad, limite_palabra, tolera_plural, activa, nota')
        .order('prioridad')
        .order('id')
        .limit(5000),
      supabase.rpc('admin_keyword_conteos'),
      supabase
        .from('keyword_candidatas')
        .select('id, senal, categoria_propuesta, veces_vista, estado, evidencia')
        .order('veces_vista', { ascending: false })
        .limit(2000),
      supabase
        .from('clasificacion_pendiente')
        .select('id, contrato_id, categoria_p1, categoria_p2, origen, votos, estado, nota, titulo')
        .in('estado', ['pendiente', 'observacion'])
        .order('estado')
        .order('contrato_id', { ascending: false })
        .limit(500),
    ])
    if (kwRes.error) {
      setError(kwRes.error.message)
      setLoading(false)
      return
    }
    if (cntRes.error) {
      setError(cntRes.error.message)
      setLoading(false)
      return
    }
    if (candRes.error) {
      setError(candRes.error.message)
      setLoading(false)
      return
    }
    if (colaRes.error) {
      setError(colaRes.error.message)
      setLoading(false)
      return
    }
    const counts = new Map<number, number>()
    for (const r of (cntRes.data ?? []) as { keyword_id: number; n: number }[]) {
      counts.set(Number(r.keyword_id), Number(r.n))
    }
    setRows((kwRes.data ?? []).map((r) => ({
      ...r,
      etiquetas: counts.get(r.id) ?? 0,
    })) as KeywordRow[])
    setCands((candRes.data ?? []) as CandidataRow[])
    setCola((colaRes.data ?? []) as ColaRow[])
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const visibles = useMemo(() => {
    let out = rows
    if (filtroCat) out = out.filter((r) => r.categoria === filtroCat)
    if (filtroTipo) out = out.filter((r) => r.tipo === filtroTipo)
    if (filtroActiva === 'activas') out = out.filter((r) => r.activa)
    if (filtroActiva === 'inactivas') out = out.filter((r) => !r.activa)
    const mul = sortAsc ? 1 : -1
    return [...out].sort((a, b) => {
      if (sort === 'etiquetas') return (a.etiquetas - b.etiquetas) * mul
      if (sort === 'prioridad') return (a.prioridad - b.prioridad) * mul
      if (sort === 'keyword') return a.keyword.localeCompare(b.keyword) * mul
      return a.categoria.localeCompare(b.categoria) * mul
    })
  }, [rows, filtroCat, filtroTipo, filtroActiva, sort, sortAsc])

  function clickSort(k: SortKey) {
    if (sort === k) setSortAsc((v) => !v)
    else {
      setSort(k)
      setSortAsc(k !== 'etiquetas')
    }
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
    if (simForm.etiquetaria > 100) {
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
    if (simCand.r.etiquetaria > 100) {
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
    const cat = catElegida[r.id] || sugeridas[0] || ''
    if (!cat) {
      setError('Elegí una categoría para aprobar.')
      return
    }
    setBusyId(r.id)
    setError(null)
    const res = await colaAprobar(token, r.id, cat)
    setBusyId(null)
    if (!res.ok) {
      setError(res.err.mensaje || `HTTP ${res.status}`)
      return
    }
    setOk(`Aprobado ${r.contrato_id} → ${cat} (capa humano).`)
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

  const th = (k: SortKey, label: string) => (
    <th className="px-3 py-2 font-medium">
      <button type="button" onClick={() => clickSort(k)} className="hover:underline">
        {label}
        {sort === k ? (sortAsc ? ' ↑' : ' ↓') : ''}
      </button>
    </th>
  )

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-3 py-5 sm:px-4">
      <div>
        <h1 className="text-lg font-medium">Keywords</h1>
        <p className="text-sm text-slate-500">
          Vocabulario de clasificación. Los cambios valen para altas nuevas.
          El backfill del corpus sigue siendo del pipeline. No se borra: solo se desactiva.
        </p>
      </div>

      {error && <ErrorBox retry={() => void load()}>{error}</ErrorBox>}
      {ok && (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">
          {ok}
        </p>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Cola de revisión</h2>
        <p className="text-xs text-slate-500">
          Discrepancias de Gemini. Aprobar escribe capa=humano. Rechazar deja el
          contrato sin clasificar y entra al ledger. Escritura vía admin-keywords.
        </p>
        {loading ? (
          <Skeleton className="h-32 w-full" />
        ) : cola.length === 0 ? (
          <EmptyState title="Cola vacía" hint="Gemini semanal carga pendientes acá." />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
                <tr>
                  <th className="px-3 py-2 font-medium">Id</th>
                  <th className="px-3 py-2 font-medium">Título</th>
                  <th className="px-3 py-2 font-medium">Origen</th>
                  <th className="px-3 py-2 font-medium">P1 / P2</th>
                  <th className="px-3 py-2 font-medium">Votos</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {cola.map((r) => {
                  const sugeridas = catsSugeridas(r)
                  const elegida = catElegida[r.id] || sugeridas[0] || KEYWORD_CATS[0]
                  const votosTxt = r.votos
                    ? Object.entries(r.votos).map(([, v]) => v).join(' · ')
                    : '—'
                  return (
                    <tr key={r.id} className="border-t border-slate-200 dark:border-slate-800">
                      <td className="px-3 py-2 font-mono text-xs">{r.contrato_id}</td>
                      <td className="max-w-[18rem] truncate px-3 py-2 text-xs" title={r.titulo ?? ''}>
                        {r.titulo || '—'}
                      </td>
                      <td className="px-3 py-2 text-xs">{r.origen || '—'}</td>
                      <td className="px-3 py-2 text-xs">
                        {r.categoria_p1 || '—'}
                        {' / '}
                        {r.categoria_p2 || '—'}
                      </td>
                      <td className="max-w-[12rem] truncate px-3 py-2 text-xs" title={votosTxt}>{votosTxt}</td>
                      <td className="px-3 py-2 text-xs">{r.estado}</td>
                      <td className="px-3 py-2">
                        {r.estado === 'observacion' ? (
                          <span className="text-xs text-slate-500" title={r.nota ?? ''}>
                            {r.nota || 'límite conocido'}
                          </span>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={elegida}
                              onChange={(e) => setCatElegida((m) => ({ ...m, [r.id]: e.target.value }))}
                              className="rounded border border-slate-300 bg-white px-1 py-1 text-xs dark:border-slate-700 dark:bg-slate-950"
                            >
                              {(sugeridas.length ? sugeridas : [...KEYWORD_CATS]).map((c) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                              {sugeridas.length > 0 && KEYWORD_CATS.filter((c) => !sugeridas.includes(c)).map((c) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              disabled={busyId === r.id}
                              onClick={() => void onAprobarCola(r)}
                              className="text-xs font-medium text-teal-700 hover:underline disabled:opacity-50 dark:text-teal-400"
                            >
                              {busyId === r.id ? '…' : 'Aprobar'}
                            </button>
                            <button
                              type="button"
                              disabled={busyId === r.id}
                              onClick={() => void onRechazarCola(r)}
                              className="text-xs font-medium text-slate-600 hover:underline disabled:opacity-50 dark:text-slate-300"
                            >
                              Rechazar
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-slate-500">
          {cola.filter((r) => r.estado === 'pendiente').length} pendientes
          {' · '}
          {cola.filter((r) => r.estado === 'observacion').length} observaciones
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Agregar keyword</h2>
        <form
          onSubmit={simForm ? onCrear : onSimularForm}
          className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-2"
        >
          <label className="block text-sm sm:col-span-2">
            <span className="text-slate-600 dark:text-slate-300">Keyword</span>
            <input
              required
              minLength={2}
              value={kw}
              onChange={(e) => { setKw(e.target.value); setSimForm(null) }}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600 dark:text-slate-300">Categoría</span>
            <select
              value={cat}
              onChange={(e) => { setCat(e.target.value); setSimForm(null) }}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              {KEYWORD_CATS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-600 dark:text-slate-300">Tipo</span>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as 'incluye' | 'excluye')}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="incluye">incluye</option>
              <option value="excluye">excluye</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={limite} onChange={(e) => { setLimite(e.target.checked); setSimForm(null) }} />
            Límite de palabra
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-slate-600 dark:text-slate-300">Nota</span>
            <input
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          {simForm && <div className="sm:col-span-2"><PanelSimular r={simForm} umbral={simForm.etiquetaria > 100} /></div>}
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={saving || simulating}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-60"
            >
              {simulating ? 'Simulando…' : saving ? 'Guardando…' : simForm ? 'Guardar' : 'Simular impacto'}
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">it_keywords</h2>
        <div className="flex flex-wrap gap-2">
          <Chip active={!filtroCat} onClick={() => setFiltroCat('')}>Todas</Chip>
          {KEYWORD_CATS.map((c) => (
            <Chip key={c} active={filtroCat === c} onClick={() => setFiltroCat(c)}>{c}</Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip active={!filtroTipo} onClick={() => setFiltroTipo('')}>tipo: todos</Chip>
          <Chip active={filtroTipo === 'incluye'} onClick={() => setFiltroTipo('incluye')}>incluye</Chip>
          <Chip active={filtroTipo === 'excluye'} onClick={() => setFiltroTipo('excluye')}>excluye</Chip>
          <Chip active={filtroActiva === 'todas'} onClick={() => setFiltroActiva('todas')}>activas+inactivas</Chip>
          <Chip active={filtroActiva === 'activas'} onClick={() => setFiltroActiva('activas')}>activas</Chip>
          <Chip active={filtroActiva === 'inactivas'} onClick={() => setFiltroActiva('inactivas')}>inactivas</Chip>
        </div>
        {loading ? (
          <Skeleton className="h-48 w-full" />
        ) : visibles.length === 0 ? (
          <EmptyState title="Sin keywords" hint="Probá otro filtro." />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
                <tr>
                  {th('categoria', 'Categoría')}
                  {th('keyword', 'Keyword')}
                  <th className="px-3 py-2 font-medium">Tipo</th>
                  {th('prioridad', 'Pri')}
                  <th className="px-3 py-2 font-medium">Límite</th>
                  <th className="px-3 py-2 font-medium">Plural</th>
                  <th className="px-3 py-2 font-medium">Activa</th>
                  <th className="px-3 py-2 font-medium">Nota</th>
                  {th('etiquetas', 'Etiquetas')}
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {visibles.map((r) => (
                  <tr key={r.id} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="px-3 py-2">{r.categoria}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.keyword}</td>
                    <td className="px-3 py-2">{r.tipo}</td>
                    <td className="px-3 py-2 tabular-nums">{r.prioridad}</td>
                    <td className="px-3 py-2">{r.limite_palabra ? 'sí' : '—'}</td>
                    <td className="px-3 py-2">{r.tolera_plural ? 'sí' : '—'}</td>
                    <td className="px-3 py-2">{r.activa ? 'sí' : 'no'}</td>
                    <td className="max-w-[12rem] truncate px-3 py-2 text-xs text-slate-500" title={r.nota ?? ''}>{r.nota || '—'}</td>
                    <td className="px-3 py-2 tabular-nums">{r.etiquetas.toLocaleString('es-PE')}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => void toggleActiva(r)}
                        className="text-xs font-medium text-teal-700 hover:underline disabled:opacity-50 dark:text-teal-400"
                      >
                        {busyId === r.id ? '…' : r.activa ? 'Desactivar' : 'Activar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-slate-500">{visibles.length.toLocaleString('es-PE')} filas · no hay borrar · prioridad de categoría se cambia por SQL</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Candidatas</h2>
        {loading ? (
          <Skeleton className="h-32 w-full" />
        ) : cands.length === 0 ? (
          <EmptyState title="Sin candidatas" hint="Las registra Gemini en el semanal." />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
                <tr>
                  <th className="px-3 py-2 font-medium">Señal original</th>
                  <th className="px-3 py-2 font-medium">Término</th>
                  <th className="px-3 py-2 font-medium">Categoría</th>
                  <th className="px-3 py-2 font-medium">Veces</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {cands.map((c) => (
                  <tr key={c.id} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="max-w-[16rem] truncate px-3 py-2 text-xs" title={senalOriginal(c)}>{senalOriginal(c)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{terminoDe(c)}</td>
                    <td className="px-3 py-2">{c.categoria_propuesta}</td>
                    <td className="px-3 py-2 tabular-nums">{c.veces_vista}</td>
                    <td className="px-3 py-2">{c.estado}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        disabled={busyId === c.id}
                        onClick={() => void onSimularCand(c)}
                        className="text-xs font-medium text-teal-700 hover:underline disabled:opacity-50 dark:text-teal-400"
                      >
                        {busyId === c.id ? '…' : 'Simular'}
                      </button>
                      {simCand?.id === c.id && (
                        <button
                          type="button"
                          disabled={busyId === c.id}
                          onClick={() => void onPromover(c)}
                          className="ml-3 text-xs font-medium text-teal-700 hover:underline disabled:opacity-50 dark:text-teal-400"
                        >
                          Promover
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {simCand && (
          <PanelSimular r={simCand.r} umbral={simCand.r.etiquetaria > 100} />
        )}
      </section>
    </div>
  )
}

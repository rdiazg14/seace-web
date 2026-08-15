import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Contrato } from '../types'
import { IT_CHIPS, OBJETOS } from '../lib/cats'
import { Chip, EmptyState, ErrorBox, Skeleton } from '../components/ui'
import ContratoCard from '../components/ContratoCard'

type SortKey = 'relevancia' | 'publica' | 'cierre'

function sanitize(q: string) {
  return q.replace(/[%(),]/g, ' ').replace(/\s+/g, ' ').trim()
}

export default function Buscador() {
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const [objetos, setObjetos] = useState<string[]>([])
  const [estados, setEstados] = useState<string[]>([])
  const [cats, setCats] = useState<string[]>([])
  const [sort, setSort] = useState<SortKey>('relevancia')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<Contrato[]>([])
  const [total, setTotal] = useState(0)
  const [ms, setMs] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sugs, setSugs] = useState<string[]>([])
  const [showSug, setShowSug] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  const buscar = useCallback(async (term: string, p = 1) => {
    setLoading(true)
    setError(null)
    const t0 = performance.now()
    const termino = sanitize(term)
    try {
      if (sort === 'relevancia' && termino) {
        const { data, error: err } = await supabase.rpc('buscar_contratos', {
          termino,
          filtro_objeto: objetos.length === 1 ? objetos[0] : null,
          filtro_estado: estados.length === 1 ? estados[0] : null,
          filtro_entidad: null,
          limite: 80,
          offset_val: 0,
        })
        if (err) throw err
        let list = (data ?? []) as Contrato[]
        if (objetos.length > 1) list = list.filter(r => objetos.includes(r.objeto))
        if (estados.length > 1) list = list.filter(r => estados.includes(r.estado))
        if (cats.length) list = list.filter(r => r.categoria_it && cats.includes(r.categoria_it))
        const from = (p - 1) * 20
        setTotal(list.length)
        setRows(list.slice(from, from + 20))
      } else {
        let query = supabase.from('contratos').select('*', { count: 'exact' })
        if (objetos.length) query = query.in('objeto', objetos)
        if (estados.length) query = query.in('estado', estados)
        if (cats.length) query = query.in('categoria_it', cats)
        if (termino) {
          query = query.or(
            `descripcion.ilike.%${termino}%,descripcion_contrato.ilike.%${termino}%,entidad.ilike.%${termino}%`,
          )
        }
        if (sort === 'cierre') query = query.order('fecha_fin_cotizacion', { ascending: true })
        else query = query.order('fecha_publica', { ascending: false })
        const from = (p - 1) * 20
        const { data, count, error: err } = await query.range(from, from + 19)
        if (err) throw err
        setRows((data ?? []) as Contrato[])
        setTotal(count ?? 0)
      }
      setMs(Math.round(performance.now() - t0))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al buscar')
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [objetos, estados, cats, sort])

  useEffect(() => {
    const initial = params.get('q') ?? ''
    setQ(initial)
    void buscar(initial, 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setPage(1)
    void buscar(q, 1)
  }, [objetos, estados, cats, sort]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = q.trim()
    if (t.length < 3) {
      setSugs([])
      return
    }
    const handle = window.setTimeout(async () => {
      const { data } = await supabase
        .from('contratos')
        .select('entidad')
        .ilike('entidad', `%${sanitize(t)}%`)
        .limit(40)
      const uniq = [...new Set((data ?? []).map(r => r.entidad as string))].slice(0, 8)
      setSugs(uniq)
    }, 250)
    return () => window.clearTimeout(handle)
  }, [q])

  function submit(term = q, p = 1) {
    setPage(p)
    setShowSug(false)
    setParams(term ? { q: term } : {})
    void buscar(term, p)
  }

  function toggle(list: string[], set: (v: string[]) => void, v: string) {
    set(list.includes(v) ? list.filter(x => x !== v) : [...list, v])
  }

  const pages = Math.max(1, Math.ceil(total / 20))
  const hayIT = useMemo(() => rows.some(r => r.categoria_it) || cats.length > 0, [rows, cats])

  return (
    <div className="mx-auto max-w-3xl px-3 py-5 sm:px-4">
      <h1 className="mb-3 text-xl">Buscador SEACE</h1>

      <div ref={boxRef} className="relative">
        <input
          value={q}
          onChange={e => { setQ(e.target.value); setShowSug(true) }}
          onFocus={() => setShowSug(true)}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
          placeholder="Busca por texto, entidad o número de contrato"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-900"
        />
        <button
          type="button"
          onClick={() => submit()}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-teal-500 px-3 py-1.5 text-xs font-medium text-white"
        >
          Buscar
        </button>
        {showSug && sugs.length > 0 && (
          <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
            {sugs.map(s => (
              <li key={s}>
                <button
                  type="button"
                  className="w-full truncate px-4 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                  onClick={() => { setQ(s); submit(s) }}
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="-mx-3 mt-3 flex gap-1.5 overflow-x-auto px-3 pb-1">
        <Chip active={objetos.length === 0} onClick={() => setObjetos([])}>Todos</Chip>
        {OBJETOS.map(o => (
          <Chip key={o} active={objetos.includes(o)} onClick={() => toggle(objetos, setObjetos, o)}>{o}</Chip>
        ))}
      </div>
      <div className="-mx-3 mt-2 flex gap-1.5 overflow-x-auto px-3 pb-1">
        <Chip active={estados.length === 0} onClick={() => setEstados([])}>Todos</Chip>
        <Chip tone="ok" active={estados.includes('Vigente')} onClick={() => toggle(estados, setEstados, 'Vigente')}>Vigente</Chip>
        <Chip tone="warn" active={estados.includes('En Evaluación')} onClick={() => toggle(estados, setEstados, 'En Evaluación')}>En Evaluación</Chip>
        <Chip tone="muted" active={estados.includes('Culminado')} onClick={() => toggle(estados, setEstados, 'Culminado')}>Culminado</Chip>
      </div>
      {hayIT && (
        <div className="-mx-3 mt-2 flex gap-1.5 overflow-x-auto px-3 pb-1">
          <Chip tone="accent" active={cats.length === 0} onClick={() => setCats([])}>IT todas</Chip>
          {IT_CHIPS.map(c => (
            <Chip key={c.id} tone="accent" active={cats.includes(c.id)} onClick={() => toggle(cats, setCats, c.id)}>
              {c.label}
            </Chip>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <p>{loading ? 'Buscando…' : `${total.toLocaleString('es-PE')} resultados en ${ms} ms`}</p>
        <label className="flex items-center gap-2">
          Ordenar
          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortKey)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="relevancia">Relevancia</option>
            <option value="publica">Fecha publicación</option>
            <option value="cierre">Fecha cierre</option>
          </select>
        </label>
      </div>

      <div className="mt-4 space-y-3">
        {error && <ErrorBox retry={() => submit()}>{error}</ErrorBox>}
        {loading && [1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
        {!loading && !error && rows.length === 0 && (
          <EmptyState title="Sin resultados" hint="Prueba otro término o quita filtros." />
        )}
        {!loading && rows.map(c => <ContratoCard key={c.id} c={c} />)}
      </div>

      {pages > 1 && (
        <div className="mt-5 flex items-center justify-center gap-2 text-sm">
          <button type="button" disabled={page <= 1} onClick={() => submit(q, page - 1)} className="rounded-lg border px-3 py-1 disabled:opacity-40 dark:border-slate-700">
            Anterior
          </button>
          <span className="text-xs text-slate-500">{page} / {pages}</span>
          <button type="button" disabled={page >= pages} onClick={() => submit(q, page + 1)} className="rounded-lg border px-3 py-1 disabled:opacity-40 dark:border-slate-700">
            Siguiente
          </button>
        </div>
      )}
    </div>
  )
}

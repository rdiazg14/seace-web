import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Contrato } from '../types'
import ContratoCard from '../components/ContratoCard'

const OBJETOS = ['', 'Bien', 'Servicio', 'Obra', 'Consultoría de Obra']
const ESTADOS = ['', 'Vigente', 'En Evaluación', 'Culminado']
const PAGE_SIZE = 20

export default function Buscador() {
  const [query, setQuery] = useState('')
  const [objeto, setObjeto] = useState('')
  const [estado, setEstado] = useState('')
  const [resultados, setResultados] = useState<Contrato[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [buscado, setBuscado] = useState(false)

  async function buscar(p = 0) {
    setLoading(true)
    setBuscado(true)
    setPage(p)
    const { data } = await supabase.rpc('buscar_contratos', {
      termino: query || '',
      filtro_objeto: objeto || null,
      filtro_estado: estado || null,
      filtro_entidad: null,
      limite: PAGE_SIZE,
      offset_val: p * PAGE_SIZE,
    })
    setResultados((data as Contrato[]) ?? [])
    // estimate total from first page result count
    if (p === 0) setTotal(data?.length === PAGE_SIZE ? null : data?.length ?? 0)
    setLoading(false)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100 mb-1">Buscador</h1>
        <p className="text-slate-400 text-sm">Búsqueda full-text en 76,250 contratos del SEACE</p>
      </div>

      {/* Search bar */}
      <form
        onSubmit={e => { e.preventDefault(); buscar(0) }}
        className="bg-slate-800 border border-slate-700 rounded-lg p-4 mb-4"
      >
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="ej: inteligencia artificial, token criptográfico, ciberseguridad…"
            className="flex-1 bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-md transition-colors whitespace-nowrap"
          >
            Buscar
          </button>
        </div>

        <div className="flex flex-wrap gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Tipo de objeto</label>
            <select
              value={objeto}
              onChange={e => setObjeto(e.target.value)}
              className="bg-slate-900 border border-slate-600 rounded-md px-2 py-1.5 text-slate-300 text-sm focus:outline-none focus:border-emerald-500"
            >
              {OBJETOS.map(o => <option key={o} value={o}>{o || 'Todos'}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Estado</label>
            <select
              value={estado}
              onChange={e => setEstado(e.target.value)}
              className="bg-slate-900 border border-slate-600 rounded-md px-2 py-1.5 text-slate-300 text-sm focus:outline-none focus:border-emerald-500"
            >
              {ESTADOS.map(e => <option key={e} value={e}>{e || 'Todos'}</option>)}
            </select>
          </div>
        </div>
      </form>

      {/* Results */}
      {loading && (
        <div className="text-center py-12">
          <div className="inline-block w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm mt-2">Buscando…</p>
        </div>
      )}

      {!loading && buscado && (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-slate-400 text-sm">
              {resultados.length === 0
                ? 'Sin resultados.'
                : `${resultados.length} resultado${resultados.length !== 1 ? 's' : ''}${total === null ? '+' : ''}`}
            </p>
          </div>

          <div className="space-y-3">
            {resultados.map(c => <ContratoCard key={c.id} c={c} />)}
          </div>

          {/* Pagination */}
          {resultados.length === PAGE_SIZE && (
            <div className="flex justify-center gap-3 mt-6">
              {page > 0 && (
                <button
                  onClick={() => buscar(page - 1)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-md transition-colors"
                >
                  ← Anterior
                </button>
              )}
              <span className="px-4 py-2 text-slate-400 text-sm">Página {page + 1}</span>
              <button
                onClick={() => buscar(page + 1)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-md transition-colors"
              >
                Siguiente →
              </button>
            </div>
          )}
        </>
      )}

      {!buscado && (
        <div className="text-center py-16">
          <p className="text-slate-500 text-4xl mb-3">🔍</p>
          <p className="text-slate-400 text-sm">
            Escribe un término y presiona <strong className="text-slate-300">Buscar</strong>
          </p>
          <p className="text-slate-500 text-xs mt-2">
            Prueba: "token", "ciberseguridad", "inteligencia artificial", "oracle"
          </p>
        </div>
      )}
    </div>
  )
}

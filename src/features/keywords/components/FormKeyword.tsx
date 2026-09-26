import type { FormEvent } from 'react'
import { KEYWORD_CATS } from '../../../lib/cats'
import { UMBRAL_SIMULACION } from '../model'
import type { SimularResultado } from '../api'
import { PanelSimular } from './PanelSimular'

export function FormKeyword({
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
  onSimularForm,
  onCrear,
}: {
  kw: string
  setKw: (v: string) => void
  cat: string
  setCat: (v: string) => void
  tipo: 'incluye' | 'excluye'
  setTipo: (v: 'incluye' | 'excluye') => void
  limite: boolean
  setLimite: (v: boolean) => void
  nota: string
  setNota: (v: string) => void
  simForm: SimularResultado | null
  setSimForm: (v: SimularResultado | null) => void
  saving: boolean
  simulating: boolean
  onSimularForm: (e?: FormEvent) => Promise<void>
  onCrear: (e: FormEvent) => Promise<void>
}) {
  return (
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
        {simForm && <div className="sm:col-span-2"><PanelSimular r={simForm} umbral={simForm.etiquetaria > UMBRAL_SIMULACION} /></div>}
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
  )
}

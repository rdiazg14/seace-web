import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Perfil, Rol } from '../types'
import { EmptyState, ErrorBox, Skeleton } from '../components/ui'

async function mensajeFn(error: { message: string; context?: Response }): Promise<string> {
  try {
    if (error.context) {
      const j = await error.context.json() as { mensaje?: string; error?: string }
      return j.mensaje || j.error || error.message
    }
  } catch {
    /* cuerpo no JSON */
  }
  return error.message
}

export default function Usuarios() {
  const { perfil: yo } = useAuth()
  const [rows, setRows] = useState<Perfil[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rol, setRol] = useState<Rol>('normal')
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('perfiles')
      .select('id, email, rol, creado_por, created_at')
      .order('created_at', { ascending: false })
    if (err) setError(err.message)
    else setRows((data ?? []) as Perfil[])
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  async function crear(e: FormEvent) {
    e.preventDefault()
    setOk(null)
    setError(null)
    setSaving(true)
    const { error: err } = await supabase.functions.invoke('crear-usuario', {
      body: { email: email.trim(), password, rol },
    })
    setSaving(false)
    if (err) {
      setError(await mensajeFn(err))
      return
    }
    setOk(`Usuario ${email.trim()} creado.`)
    setEmail('')
    setPassword('')
    setRol('normal')
    await load()
  }

  async function desactivar(id: string, mail: string) {
    if (!confirm(`¿Desactivar ${mail}? No podrá entrar.`)) return
    setOk(null)
    setError(null)
    setBusyId(id)
    const { error: err } = await supabase.functions.invoke('desactivar-usuario', {
      body: { id },
    })
    setBusyId(null)
    if (err) {
      setError(await mensajeFn(err))
      return
    }
    setOk(`${mail} desactivado.`)
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-3 py-5 sm:px-4">
      <div>
        <h1 className="text-lg font-medium">Usuarios</h1>
        <p className="text-sm text-slate-500">Solo admin. El registro público está cerrado.</p>
      </div>

      {error && <ErrorBox retry={() => void load()}>{error}</ErrorBox>}
      {ok && (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">
          {ok}
        </p>
      )}

      <form
        onSubmit={crear}
        className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-2"
      >
        <p className="sm:col-span-2 text-sm font-medium">Crear usuario</p>
        <label className="block text-sm">
          <span className="text-slate-600 dark:text-slate-300">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-600 dark:text-slate-300">Clave temporal (mín. 8)</span>
          <input
            type="text"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-600 dark:text-slate-300">Rol</span>
          <select
            value={rol}
            onChange={e => setRol(e.target.value as Rol)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="normal">normal</option>
            <option value="admin">admin</option>
          </select>
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-60"
          >
            {saving ? 'Creando…' : 'Crear'}
          </button>
        </div>
      </form>

      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState title="No hay perfiles" hint="Crea el primero con el formulario." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
              <tr>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Rol</th>
                <th className="px-3 py-2 font-medium">Alta</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t border-slate-200 dark:border-slate-800">
                  <td className="px-3 py-2">{r.email}</td>
                  <td className="px-3 py-2">
                    <span className={r.rol === 'admin' ? 'text-teal-600 dark:text-teal-400' : 'text-slate-500'}>
                      {r.rol}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-500">
                    {r.created_at ? new Date(r.created_at).toLocaleDateString('es-PE') : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {yo?.id === r.id ? (
                      <span className="text-xs text-slate-400">tú</span>
                    ) : (
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => void desactivar(r.id, r.email)}
                        className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
                      >
                        {busyId === r.id ? '…' : 'Desactivar'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { ErrorBox } from '../components/ui'

export default function CambiarClave() {
  const { perfil, session, signOut } = useAuth()
  const email = perfil?.email || session?.user?.email || ''

  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repite, setRepite] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [saving, setSaving] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setOk(false)

    if (nueva.length < 8) {
      setError('La nueva clave debe tener al menos 8 caracteres.')
      return
    }
    if (nueva !== repite) {
      setError('Las claves nuevas no coinciden.')
      return
    }

    setSaving(true)

    // Re-autenticar para confirmar que la clave actual es correcta.
    const { error: reauthErr } = await supabase.auth.signInWithPassword({
      email,
      password: actual,
    })
    if (reauthErr) {
      setSaving(false)
      setError('La clave actual es incorrecta.')
      return
    }

    const { error: updErr } = await supabase.auth.updateUser({ password: nueva })
    setSaving(false)

    if (updErr) {
      setError(updErr.message)
      return
    }

    setOk(true)
    setActual('')
    setNueva('')
    setRepite('')
  }

  return (
    <div className="mx-auto max-w-md space-y-6 px-3 py-6 sm:px-4">
      <div>
        <h1 className="text-lg font-medium">Cambiar contraseña</h1>
        <p className="text-sm text-slate-500">{email}</p>
      </div>

      {error && <ErrorBox>{error}</ErrorBox>}
      {ok && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">
          <p>Clave actualizada correctamente.</p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-2 text-xs font-medium underline"
          >
            Cerrar sesión
          </button>
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
      >
        <label className="block text-sm">
          <span className="text-slate-600 dark:text-slate-300">Clave actual</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={actual}
            onChange={e => setActual(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <label className="block text-sm">
          <span className="text-slate-600 dark:text-slate-300">Nueva clave (mín. 8)</span>
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={nueva}
            onChange={e => setNueva(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <label className="block text-sm">
          <span className="text-slate-600 dark:text-slate-300">Repetir nueva clave</span>
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={repite}
            onChange={e => setRepite(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-teal-600 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-60"
        >
          {saving ? 'Guardando…' : 'Guardar nueva clave'}
        </button>
      </form>
    </div>
  )
}

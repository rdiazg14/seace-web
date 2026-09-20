import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { ErrorBox } from '../components/ui'

/**
 * Aterrizaje del enlace de recuperación («Olvidé mi clave»).
 * Con detectSessionInUrl:true, el cliente de Supabase ya intercambió el
 * código del enlace por una sesión de recuperación; acá solo se pide la
 * nueva clave y se llama updateUser({ password }).
 */
export default function RecuperarClave() {
  const { session, loading, signOut } = useAuth()

  const [nueva, setNueva] = useState('')
  const [repite, setRepite] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (nueva.length < 8) {
      setError('La nueva clave debe tener al menos 8 caracteres.')
      return
    }
    if (nueva !== repite) {
      setError('Las claves no coinciden.')
      return
    }

    setSaving(true)
    const { error: err } = await supabase.auth.updateUser({ password: nueva })
    setSaving(false)

    if (err) {
      setError(err.message)
      return
    }

    // La sesión de recuperación ya no sirve; se cierra y vuelve al login.
    await signOut()
    setDone(true)
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-sm">
        <div>
          <p className="text-lg font-medium tracking-tight text-teal-600 dark:text-teal-400">SEACE Monitor</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Creá una nueva clave para tu cuenta.
          </p>
        </div>

        {loading && <p className="text-sm text-[var(--text-secondary)]">Verificando enlace…</p>}

        {!loading && !session && !done && (
          <div className="space-y-3">
            <ErrorBox>
              El enlace es inválido o ya expiró. Pedí uno nuevo desde la pantalla de inicio.
            </ErrorBox>
            <Link
              to="/login"
              className="block w-full rounded-lg bg-teal-600 py-2 text-center text-sm font-medium text-white hover:bg-teal-500"
            >
              Volver a entrar
            </Link>
          </div>
        )}

        {!loading && session && !done && (
          <form onSubmit={onSubmit} className="space-y-4">
            {error && <ErrorBox>{error}</ErrorBox>}

            <label className="block text-sm">
              <span className="text-[var(--text-secondary)]">Nueva clave (mín. 8)</span>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                autoFocus
                value={nueva}
                onChange={e => setNueva(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)]"
              />
            </label>

            <label className="block text-sm">
              <span className="text-[var(--text-secondary)]">Repetir nueva clave</span>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={repite}
                onChange={e => setRepite(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)]"
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
        )}

        {done && (
          <div className="space-y-3">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">
              Clave actualizada correctamente. Ya podés entrar con tu nueva clave.
            </div>
            <Link
              to="/login"
              className="block w-full rounded-lg bg-teal-600 py-2 text-center text-sm font-medium text-white hover:bg-teal-500"
            >
              Ir a entrar
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

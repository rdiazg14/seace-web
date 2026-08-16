import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useTheme } from '../lib/theme'
import { ErrorBox } from '../components/ui'

export default function Login() {
  const { session, loading } = useAuth()
  const { theme, toggle } = useTheme()
  const loc = useLocation()
  const from = (loc.state as { from?: string } | null)?.from || '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  if (!loading && session) {
    return <Navigate to={from === '/login' ? '/' : from} replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSending(true)
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setSending(false)
    if (err) {
      setError('Email o clave incorrectos.')
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="absolute right-3 top-3">
        <button
          type="button"
          onClick={toggle}
          aria-label="Cambiar tema"
          className="rounded-md p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          {theme === 'dark' ? 'Claro' : 'Oscuro'}
        </button>
      </div>

      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <div>
          <p className="text-lg font-medium tracking-tight text-teal-600 dark:text-teal-400">SEACE Monitor</p>
          <p className="mt-1 text-sm text-slate-500">Entra con la cuenta que te asignó el admin.</p>
        </div>

        {error && <ErrorBox>{error}</ErrorBox>}

        <label className="block text-sm">
          <span className="text-slate-600 dark:text-slate-300">Email</span>
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <label className="block text-sm">
          <span className="text-slate-600 dark:text-slate-300">Clave</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <button
          type="submit"
          disabled={sending || loading}
          className="w-full rounded-lg bg-teal-600 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-60"
        >
          {sending ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}

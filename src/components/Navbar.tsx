import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../lib/theme'
import { useAuth } from '../lib/auth'

const LINKS = [
  { to: '/ruta-dia', label: 'Ruta del día', end: false },
  { to: '/', label: 'Dashboard', end: true },
  { to: '/buscar', label: 'Buscador', end: false },
  { to: '/chat', label: 'Chat', end: false },
  { to: '/docs', label: 'API', end: false },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const { theme, toggle } = useTheme()
  const { perfil, signOut } = useAuth()
  const navigate = useNavigate()
  const isAdmin = perfil?.rol === 'admin'

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
      isActive
        ? 'bg-teal-500 text-white'
        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
    }`

  async function salir() {
    setOpen(false)
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg-card)]/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-3 sm:px-4">
        <NavLink to="/" className="flex min-w-0 items-center gap-2" onClick={() => setOpen(false)}>
          <span className="text-base font-medium tracking-tight text-teal-600 dark:text-teal-400">SEACE</span>
          <span className="hidden truncate text-xs text-slate-400 sm:inline">Monitor</span>
        </NavLink>

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map(l => (
            <NavLink key={l.to} to={l.to} end={l.end} className={linkCls}>
              {l.label}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink to="/usuarios" className={linkCls}>
              Usuarios
            </NavLink>
          )}
        </div>

        <div className="flex min-w-0 items-center gap-1">
          {perfil && (
            <div className="mr-1 hidden min-w-0 max-w-[14rem] text-right sm:block">
              <p className="truncate text-xs text-slate-600 dark:text-slate-300">{perfil.email}</p>
              <p className="text-[10px] uppercase tracking-wide text-slate-400">{perfil.rol}</p>
            </div>
          )}
          <button
            type="button"
            onClick={() => void salir()}
            className="hidden rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 sm:inline dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Salir
          </button>
          <button
            type="button"
            onClick={toggle}
            aria-label="Cambiar tema"
            className="rounded-md p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {theme === 'dark' ? (
              <Sun className="h-[18px] w-[18px]" />
            ) : (
              <Moon className="h-[18px] w-[18px]" />
            )}
          </button>
          <button
            type="button"
            className="rounded-md p-2 text-slate-600 md:hidden dark:text-slate-300"
            aria-label="Menú"
            onClick={() => setOpen(o => !o)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-slate-200 px-3 py-2 md:hidden dark:border-slate-800">
          {LINKS.map(l => (
            <NavLink key={l.to} to={l.to} end={l.end} className={linkCls} onClick={() => setOpen(false)}>
              {l.label}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink to="/usuarios" className={linkCls} onClick={() => setOpen(false)}>
              Usuarios
            </NavLink>
          )}
          {perfil && (
            <p className="px-3 py-2 text-xs text-slate-500">
              {perfil.email} · {perfil.rol}
            </p>
          )}
          <button
            type="button"
            onClick={() => void salir()}
            className="block w-full rounded-md px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </nav>
  )
}

import { NavLink } from 'react-router-dom'

export default function Navbar() {
  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? 'bg-emerald-600 text-white'
        : 'text-slate-300 hover:text-white hover:bg-slate-700'
    }`

  return (
    <nav className="bg-slate-900 border-b border-slate-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 font-bold text-lg tracking-tight">SEACE</span>
          <span className="text-slate-500 text-sm hidden sm:block">Monitor de Contrataciones</span>
        </div>
        <div className="flex items-center gap-1">
          <NavLink to="/" end className={linkCls}>Dashboard</NavLink>
          <NavLink to="/buscar" className={linkCls}>Buscador</NavLink>
          <NavLink to="/chat" className={linkCls}>Chat</NavLink>
          <NavLink to="/docs" className={linkCls}>API</NavLink>
        </div>
      </div>
    </nav>
  )
}

import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ThemeProvider } from './lib/theme'
import { AuthProvider } from './lib/auth'
import { RequireAuth } from './components/RequireAuth'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import Buscador from './pages/Buscador'
import Chat from './pages/Chat'
import Docs from './pages/Docs'
import Login from './pages/Login'
import Usuarios from './pages/Usuarios'

function Shell() {
  const { pathname } = useLocation()
  const login = pathname === '/login'
  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {!login && <Navbar />}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/buscar" element={<RequireAuth><Buscador /></RequireAuth>} />
        <Route path="/chat" element={<RequireAuth><Chat /></RequireAuth>} />
        <Route path="/docs" element={<RequireAuth><Docs /></RequireAuth>} />
        <Route path="/usuarios" element={<RequireAuth admin><Usuarios /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Shell />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

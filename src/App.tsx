import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { ThemeProvider } from './lib/theme'
import { AuthProvider } from './lib/auth'
import { RequireAuth } from './components/RequireAuth'
import { PageSkeleton } from './components/ui'
import Navbar from './components/Navbar'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Buscador = lazy(() => import('./pages/Buscador'))
const Chat = lazy(() => import('./pages/Chat'))
const Docs = lazy(() => import('./pages/Docs'))
const Login = lazy(() => import('./pages/Login'))
const Usuarios = lazy(() => import('./pages/Usuarios'))
const Observabilidad = lazy(() => import('./pages/Observabilidad'))
const Keywords = lazy(() => import('./pages/Keywords'))
const importRutaDia = () => import('./pages/RutaDia')
const RutaDia = lazy(importRutaDia)
// La portada espera sesión y perfil antes de montarse. Su código se pide ya,
// en paralelo, para que al resolver la sesión no empiece otra espera de red.
if (typeof window !== 'undefined' && window.location.pathname === '/') {
  void importRutaDia().catch(() => undefined)
}
const AnalisisContrato = lazy(() => import('./pages/AnalisisContrato'))
const CambiarClave = lazy(() => import('./pages/CambiarClave'))
const RecuperarClave = lazy(() => import('./pages/RecuperarClave'))
const ConfigIa = lazy(() => import('./pages/ConfigIa'))

function Shell() {
  const { pathname } = useLocation()
  const login = pathname === '/login' || pathname === '/recuperar-clave'
  return (
    <div className="min-h-dvh bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {!login && <Navbar />}
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/recuperar-clave" element={<RecuperarClave />} />
          <Route path="/" element={<RequireAuth><RutaDia /></RequireAuth>} />
          <Route path="/ruta-dia" element={<Navigate to="/" replace />} />
          <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/analisis/:id" element={<RequireAuth><AnalisisContrato /></RequireAuth>} />
          <Route path="/buscar" element={<RequireAuth><Buscador /></RequireAuth>} />
          <Route path="/chat" element={<RequireAuth><Chat /></RequireAuth>} />
          <Route path="/docs" element={<RequireAuth><Docs /></RequireAuth>} />
          <Route path="/clave" element={<RequireAuth><CambiarClave /></RequireAuth>} />
          <Route path="/usuarios" element={<RequireAuth admin><Usuarios /></RequireAuth>} />
          <Route path="/observabilidad" element={<RequireAuth admin><Observabilidad /></RequireAuth>} />
          <Route path="/keywords" element={<RequireAuth admin><Keywords /></RequireAuth>} />
          <Route path="/config-ia" element={<RequireAuth admin><ConfigIa /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
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

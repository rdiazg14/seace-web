import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../lib/auth'
import { ErrorBox, PageSkeleton } from './ui'

export function RequireAuth({
  children,
  admin = false,
}: {
  children: ReactNode
  admin?: boolean
}) {
  const { session, perfil, loading, perfilError, retryPerfil } = useAuth()
  const loc = useLocation()

  if (loading) return <PageSkeleton />

  if (!session) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  }

  if (!perfil) {
    return (
      <div className="mx-auto max-w-lg px-3 py-10">
        <ErrorBox retry={retryPerfil}>
          {perfilError || 'Tu cuenta no tiene perfil habilitado. Contacta al administrador.'}
        </ErrorBox>
      </div>
    )
  }

  if (admin && perfil.rol !== 'admin') {
    return <Navigate to="/" replace />
  }

  return children
}

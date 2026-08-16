import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../lib/auth'
import { ErrorBox, Skeleton } from './ui'

export function RequireAuth({
  children,
  admin = false,
}: {
  children: ReactNode
  admin?: boolean
}) {
  const { session, perfil, loading } = useAuth()
  const loc = useLocation()

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-3 px-3 py-8 sm:px-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  }

  if (!perfil) {
    return (
      <div className="mx-auto max-w-lg px-3 py-10">
        <ErrorBox>
          Tu cuenta no tiene perfil. Pídele al admin que revise la tabla perfiles o vuelve a entrar.
        </ErrorBox>
      </div>
    )
  }

  if (admin && perfil.rol !== 'admin') {
    return <Navigate to="/" replace />
  }

  return children
}

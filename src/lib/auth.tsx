import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Perfil, Rol } from '../types'

interface AuthCtx {
  session: Session | null
  perfil: Perfil | null
  loading: boolean
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthCtx>({
  session: null,
  perfil: null,
  loading: true,
  signOut: async () => undefined,
})

async function loadPerfil(userId: string): Promise<Perfil | null> {
  const { data, error } = await supabase
    .from('perfiles')
    .select('id, email, rol, creado_por, created_at')
    .eq('id', userId)
    .maybeSingle()
  if (error || !data) return null
  const rol: Rol = data.rol === 'admin' ? 'admin' : 'normal'
  return {
    id: data.id,
    email: data.email,
    rol,
    creado_por: data.creado_por,
    created_at: data.created_at,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function apply(next: Session | null) {
      if (cancelled) return
      setSession(next)
      if (!next?.user) {
        setPerfil(null)
        setLoading(false)
        return
      }
      const p = await loadPerfil(next.user.id)
      if (cancelled) return
      setPerfil(p)
      setLoading(false)
    }

    supabase.auth.getSession().then(({ data }) => apply(data.session))

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'INITIAL_SESSION') return
      if (event === 'TOKEN_REFRESHED') {
        setSession(next)
        return
      }
      void apply(next)
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthCtx>(() => ({
    session,
    perfil,
    loading,
    signOut: async () => {
      await supabase.auth.signOut()
    },
  }), [session, perfil, loading])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  return useContext(Ctx)
}

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Perfil, Rol } from '../types'

interface AuthCtx {
  session: Session | null
  perfil: Perfil | null
  loading: boolean
  perfilError: string | null
  retryPerfil: () => void
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthCtx>({
  session: null,
  perfil: null,
  loading: true,
  perfilError: null,
  retryPerfil: () => undefined,
  signOut: async () => undefined,
})

async function loadPerfil(userId: string, signal: AbortSignal): Promise<Perfil | null> {
  const { data, error } = await supabase
    .from('perfiles')
    .select('id, email, rol, creado_por, created_at')
    .eq('id', userId)
    .abortSignal(signal)
    .maybeSingle()
  if (error) throw new Error('perfil_no_disponible')
  if (!data) return null
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
  const [perfilError, setPerfilError] = useState<string | null>(null)
  const retry = useRef<() => void>(() => undefined)

  useEffect(() => {
    let cancelled = false
    let generation = 0
    let currentSession: Session | null = null
    let pending: ReturnType<typeof setTimeout> | undefined
    let controller: AbortController | undefined
    let deadline: ReturnType<typeof setTimeout> | undefined

    function apply(next: Session | null) {
      if (cancelled) return
      const request = ++generation
      currentSession = next
      clearTimeout(pending)
      clearTimeout(deadline)
      controller?.abort()
      setSession(next)
      setPerfil(null)
      setPerfilError(null)
      if (!next?.user) {
        setLoading(false)
        return
      }
      setLoading(true)
      // Fuera del callback Auth: las consultas pueden necesitar su mismo lock.
      pending = setTimeout(() => {
        const abort = new AbortController()
        controller = abort
        deadline = setTimeout(() => abort.abort(), 15000)
        void loadPerfil(next.user.id, abort.signal).then((p) => {
          if (!cancelled && request === generation) setPerfil(p)
        }).catch(() => {
          if (!cancelled && request === generation) setPerfilError('No pudimos cargar tu perfil. Reintenta en unos momentos.')
        }).finally(() => {
          if (!cancelled && request === generation) {
            clearTimeout(deadline)
            setLoading(false)
          }
        })
      }, 0)
    }

    retry.current = () => apply(currentSession)
    const bootstrap = generation
    void supabase.auth.getSession().then(({ data }) => {
      if (generation === bootstrap) apply(data.session)
    }).catch(() => {
      if (!cancelled && generation === bootstrap) {
        setPerfilError('No pudimos comprobar tu sesion. Recarga la pagina.')
        setLoading(false)
      }
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'INITIAL_SESSION') return
      if ((event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') && next?.user.id === currentSession?.user.id && next) {
        currentSession = next
        setSession(next)
        return
      }
      apply(next)
    })

    return () => {
      cancelled = true
      clearTimeout(pending)
      clearTimeout(deadline)
      controller?.abort()
      retry.current = () => undefined
      sub.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthCtx>(() => ({
    session,
    perfil,
    loading,
    perfilError,
    retryPerfil: () => retry.current(),
    signOut: async () => {
      await supabase.auth.signOut()
    },
  }), [session, perfil, loading, perfilError])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  return useContext(Ctx)
}

import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = 'https://wusywwhcyqngnpvpzxyr.supabase.co'
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1c3l3d2hjeXFuZ25wdnB6eHlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3NDc0NDcsImV4cCI6MjEwMjMyMzQ0N30.jDZeGaW8lQuROU7IF11clkfjgyyiMrgyIfi6LvuAFeY'

/** Proxy de IA. VITE_AI_PROXY solo se usa en desarrollo local (p. ej. proxy simulado para smoke visual). */
export const AI_PROXY = import.meta.env.DEV && import.meta.env.VITE_AI_PROXY
  ? import.meta.env.VITE_AI_PROXY
  : 'https://seace-ai-proxy.rdiazg14.workers.dev'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Procesa tokens/códigos de recuperación y confirmación de email en la URL.
    // Requerido para el flujo «Olvidé mi clave» (/recuperar-clave).
    detectSessionInUrl: true,
  },
})

/** Doble de `lib/supabase` para pruebas DOM. Sustituir el módulo real con
 *  `vi.mock('../lib/supabase', () => import('../test/fakeSupabase'))`.
 *  Las consultas resuelven con lo cargado en `setTableData`/`setRpcData`
 *  (por defecto lista vacía / null); auth, storage y functions graban llamadas. */
import { vi } from 'vitest'

export const SUPABASE_URL = 'https://fake.supabase.test'
export const SUPABASE_ANON_KEY = 'fake-anon'
export const AI_PROXY = 'https://ai-proxy.test'

interface QueryRes {
  data: unknown
  error: { message: string } | null
}

const tablas = new Map<string, unknown>()
const rpcs = new Map<string, unknown>()

export function setTableData(tabla: string, data: unknown) {
  tablas.set(tabla, data)
}

export function setRpcData(nombre: string, data: unknown) {
  rpcs.set(nombre, data)
}

export function resetSupabaseFakes() {
  tablas.clear()
  rpcs.clear()
  setAuthSession(null)
  vi.clearAllMocks()
}

/** Builder encadenable: cualquier método devuelve el mismo builder y el objeto
 *  es "awaitable" — resuelve `{data, error}` como el cliente PostgREST real. */
function query(resolver: () => QueryRes): unknown {
  const build = (res: () => QueryRes): unknown =>
    new Proxy(function () {}, {
      get(_t, prop) {
        if (prop === 'then')
          return (ok?: (v: QueryRes) => unknown, fail?: (e: unknown) => unknown) =>
            Promise.resolve().then(res).then(ok, fail)
        if (prop === 'catch')
          return (f: (e: unknown) => unknown) => Promise.resolve().then(res).catch(f)
        if (prop === 'finally')
          return (f: () => void) => Promise.resolve().then(res).finally(f)
        if (prop === 'single' || prop === 'maybeSingle')
          return () =>
            build(() => {
              const r = res()
              const data = Array.isArray(r.data) ? r.data[0] ?? null : r.data
              return { data, error: null }
            })
        return () => build(res)
      },
      apply: () => build(res),
    })
  return build(resolver)
}

let authSession: unknown = null

export function setAuthSession(session: unknown) {
  authSession = session
}

export const authCalls = {
  getSession: vi.fn(async () => ({ data: { session: authSession }, error: null })),
  onAuthStateChange: vi.fn(() => ({
    data: { subscription: { unsubscribe: () => {} } },
  })),
  signInWithPassword: vi.fn(async (_creds: { email: string; password: string }) => ({
    data: { user: null, session: null },
    error: { message: 'Invalid login credentials' },
  })),
  updateUser: vi.fn(async () => ({ data: { user: null }, error: null })),
  resetPasswordForEmail: vi.fn(async () => ({ data: {}, error: null })),
  signOut: vi.fn(async () => ({ error: null })),
}

export const supabase = {
  auth: authCalls,
  from: (tabla: string) => query(() => ({ data: tablas.get(tabla) ?? [], error: null })),
  rpc: (nombre: string) => query(() => ({ data: rpcs.get(nombre) ?? null, error: null })),
  functions: {
    invoke: vi.fn(async (_nombre: string, _opts?: { body?: unknown }) => ({
      data: null,
      error: null,
    })),
  },
  storage: {
    from: (_bucket: string) => ({
      createSignedUrl: vi.fn(async (_path: string, _ttl: number) => ({
        data: { signedUrl: 'https://fake.supabase.test/signed/tdr.pdf' },
        error: null,
      })),
      getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://fake.supabase.test/pub/tdr.pdf' } })),
      upload: vi.fn(async () => ({ data: {}, error: null })),
      download: vi.fn(async () => ({ data: new Blob(), error: null })),
      remove: vi.fn(async () => ({ data: null, error: null })),
    }),
  },
}

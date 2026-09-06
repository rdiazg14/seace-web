import { supabase } from './supabase'

/** TTL de la signed URL (1 h). El cache de sesión usa el mismo plazo menos 60 s. */
const TTL_S = 3600
const CACHE_MS = (TTL_S - 60) * 1000

type CacheEntry = { url: string; exp: number }

const cache = new Map<number, CacheEntry>()
const inflight = new Map<number, Promise<string | null>>()

/**
 * Signed URL del TDR en bucket privado `tdr`.
 * createSignedUrl(path, 3600): 1 h de validez. Cacheamos en memoria por
 * contrato_id para no firmar de nuevo en cada render de la card.
 */
export async function urlPdfTdr(
  contratoId: number,
  pdfArchivoId: number | null,
  pdfStoragePath: string | null,
): Promise<string | null> {
  const path = (pdfStoragePath || '').trim()
  if (!path) return null

  const hit = cache.get(contratoId)
  if (hit && hit.exp > Date.now()) return hit.url

  const pending = inflight.get(contratoId)
  if (pending) return pending

  const job = firmar(contratoId, pdfArchivoId, path)
  inflight.set(contratoId, job)
  try {
    return await job
  } finally {
    inflight.delete(contratoId)
  }
}

async function firmar(contratoId: number, pdfArchivoId: number | null, path: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage.from('tdr').createSignedUrl(path, TTL_S)
    if (error || !data?.signedUrl) {
      console.warn(
        'urlPdfTdr: no se pudo firmar',
        contratoId,
        pdfArchivoId,
        error?.message ?? 'sin url',
      )
      return null
    }
    cache.set(contratoId, { url: data.signedUrl, exp: Date.now() + CACHE_MS })
    return data.signedUrl
  } catch (e) {
    console.warn('urlPdfTdr: fallo', contratoId, e)
    return null
  }
}

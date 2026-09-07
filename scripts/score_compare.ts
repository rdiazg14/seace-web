/**
 * READ-ONLY: tabla comparativa score viejo vs nuevo para los 17 analisis.
 * Uso: npx tsx scripts/score_compare.ts
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ANALISIS_SCORE_SELECT,
  pdfHashContrato,
  puntuar,
  sliceDesdeFilaAnalisis,
  type AnalisisScoreSlice,
  type Contrato,
} from '../src/lib/rutaDia'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadMonitorEnv(): Record<string, string> {
  const envPath = resolve(__dirname, '../../seace-monitor/.env')
  const out: Record<string, string> = {}
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#') || !t.includes('=')) continue
    const i = t.indexOf('=')
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
  return out
}

async function main() {
  const env = loadMonitorEnv()
  const url = env.SUPABASE_URL || 'https://wusywwhcyqngnpvpzxyr.supabase.co'
  const key = env.SUPABASE_SERVICE_KEY || env.SUPABASE_ANON_KEY
  if (!key) throw new Error('falta SUPABASE_SERVICE_KEY o ANON en seace-monitor/.env')

  const sb = createClient(url, key)

  const { data: analisisRows, error: e1 } = await sb
    .from('analisis_contrato')
    .select(ANALISIS_SCORE_SELECT)
  if (e1) throw e1

  const { data: fullRows, error: eFull } = await sb
    .from('analisis_contrato')
    .select('contrato_id,pdf_hash,payload')
  if (eFull) throw eFull

  const slimBytes = JSON.stringify(analisisRows ?? []).length
  const fullBytes = JSON.stringify(fullRows ?? []).length
  console.log(`PESO_SLIM_JSON_PATH=${slimBytes} bytes (${((slimBytes / 1024)).toFixed(1)} KiB) filas=${analisisRows?.length}`)
  console.log(`PESO_FULL_PAYLOAD=${fullBytes} bytes (${((fullBytes / 1024)).toFixed(1)} KiB) filas=${fullRows?.length}`)
  console.log(`AHORRO=${(100 * (1 - slimBytes / fullBytes)).toFixed(1)}%`)

  const ids = (analisisRows ?? []).map((r: { contrato_id: number }) => r.contrato_id)
  const { data: contratos, error: e2 } = await sb
    .from('v_contratos')
    .select('id,nro_contratacion,descripcion_contrato,objeto,descripcion,entidad,estado,fecha_publica,fecha_ini_cotizacion,fecha_fin_cotizacion,tipo_cotizacion,cotizar,categoria_it,relevancia_ia,nom_area_usuaria,pdf_archivo_id,pdf_storage_path,pdf_hash')
    .in('id', ids)
  if (e2) throw e2

  const ahora = new Date()
  type Row = {
    id: number
    old: number
    neu: number
    gemini: string
    fuente: string
    califica: string
    margen: number | null
    pct: number | null
  }
  const rows: Row[] = []

  for (const c of (contratos ?? []) as unknown as Contrato[]) {
    const matches = (analisisRows ?? []).filter(
      (a: { contrato_id: number; pdf_hash: string }) =>
        a.contrato_id === c.id && a.pdf_hash === pdfHashContrato(c),
    )
    const raw = matches[0] as {
      encaje?: unknown
      economia?: unknown
      condiciones?: unknown
      veredicto?: unknown
    } | undefined
    const slice: AnalisisScoreSlice | null = raw ? sliceDesdeFilaAnalisis(raw) : null
    const old = puntuar(c, ahora, null)
    const neu = puntuar(c, ahora, slice)
    rows.push({
      id: c.id,
      old: old.score.total,
      neu: neu.score.total,
      gemini: neu.veredictoGemini ?? '—',
      fuente: neu.scoreFuente,
      califica: String(slice?.encaje?.califica ?? '—'),
      margen: neu.margenSoles,
      pct: neu.margenPct == null ? null : Math.round(neu.margenPct * 1000) / 10,
    })
  }

  const byOld = [...rows].sort((a, b) => b.old - a.old || a.id - b.id)
  const byNeu = [...rows].sort((a, b) => b.neu - a.neu || a.id - b.id)
  const ordOld = new Map(byOld.map((r, i) => [r.id, i + 1]))
  const ordNeu = new Map(byNeu.map((r, i) => [r.id, i + 1]))

  console.log('id|score_viejo|score_nuevo|gemini|ord_viejo|ord_nuevo|fuente|califica|margen|pct%')
  for (const r of byNeu) {
    console.log(
      `${r.id}|${r.old}|${r.neu}|${r.gemini}|${ordOld.get(r.id)}|${ordNeu.get(r.id)}|${r.fuente}|${r.califica}|${r.margen}|${r.pct}`,
    )
  }

  const h = rows.filter(r => r.fuente === 'heuristica').length
  console.log('---CHECKS---')
  console.log(`n=${rows.length} heuristica=${h}`)
  const r91696 = rows.find(r => r.id === 91696)
  const r92065 = rows.find(r => r.id === 92065)
  const r91505 = rows.find(r => r.id === 91505)
  console.log(`91696 neu=${r91696?.neu} ord=${ordNeu.get(91696)} (want fondo)`)
  console.log(`92065 neu=${r92065?.neu} ord=${ordNeu.get(92065)} (want top3)`)
  console.log(`91505 neu=${r91505?.neu} (<=35?)`)
  console.log(`todos_presentes=${rows.length === 17}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

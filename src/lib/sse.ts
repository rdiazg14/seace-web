/** Lectura de streams SSE del proxy: eventos JSON en líneas `data:` separados por línea en blanco. */

/** JSON del bloque o null si no trae `data:`, es `[DONE]` o no es JSON válido. */
export function parseSseBlock(block: string): unknown | null {
  const line = block.split('\n').find(l => l.startsWith('data:'))
  if (!line) return null
  const payload = line.slice(5).trim()
  if (!payload || payload === '[DONE]') return null
  try {
    return JSON.parse(payload)
  } catch {
    return null
  }
}

/**
 * Eventos del stream en orden. `flushTail` procesa un último bloque sin línea
 * en blanco final (el asistente lo hace; el chat general no).
 */
export async function* eventosSse(res: Response, opts: { flushTail?: boolean } = {}): AsyncGenerator<unknown> {
  const reader = res.body?.getReader()
  if (!reader) throw new Error('sin stream')
  const decoder = new TextDecoder()
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const parts = buf.split('\n\n')
    buf = parts.pop() ?? ''
    for (const part of parts) {
      const ev = parseSseBlock(part)
      if (ev) yield ev
    }
  }
  if (opts.flushTail && buf.trim()) {
    const ev = parseSseBlock(buf)
    if (ev) yield ev
  }
}

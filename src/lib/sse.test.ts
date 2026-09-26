import { describe, expect, it } from 'vitest'
import { eventosSse, parseSseBlock } from './sse'

function res(chunks: string[]): Response {
  const enc = new TextEncoder()
  return new Response(new ReadableStream<Uint8Array>({
    start(c) {
      for (const ch of chunks) c.enqueue(enc.encode(ch))
      c.close()
    },
  }))
}

async function todos(r: Response, flushTail?: boolean): Promise<unknown[]> {
  const out: unknown[] = []
  for await (const ev of eventosSse(r, { flushTail })) out.push(ev)
  return out
}

describe('eventosSse', () => {
  it('sin flushTail ignora un bloque final sin línea en blanco (chat general)', async () => {
    expect(await todos(res(['data: {"a":1}\n\ndata: {"b":2}']))).toEqual([{ a: 1 }])
  })

  it('con flushTail procesa el bloque final (asistente)', async () => {
    expect(await todos(res(['data: {"a":1}\n\ndata: {"b":2}']), true)).toEqual([{ a: 1 }, { b: 2 }])
  })

  it('un error lanzado por el consumidor detiene la lectura', async () => {
    const seen: unknown[] = []
    await expect((async () => {
      for await (const ev of eventosSse(res(['data: {"a":1}\n\ndata: {"b":2}\n\n']))) {
        seen.push(ev)
        throw new Error('stop')
      }
    })()).rejects.toThrow('stop')
    expect(seen).toEqual([{ a: 1 }])
  })

  it('parseSseBlock descarta bloques sin data, [DONE] y JSON inválido', () => {
    expect(parseSseBlock(': ping')).toBeNull()
    expect(parseSseBlock('data: [DONE]')).toBeNull()
    expect(parseSseBlock('data: {x')).toBeNull()
    expect(parseSseBlock('event: m\ndata: {"ok":true}')).toEqual({ ok: true })
  })
})

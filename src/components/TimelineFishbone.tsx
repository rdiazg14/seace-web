import { useId, useState } from 'react'
import { Maximize2 } from 'lucide-react'
import { Modal } from './Modal'
import type { Timeline, TimelineHito, TimelineHitoTipo } from '../lib/analisis'

const TIPOS: TimelineHitoTipo[] = ['inicio', 'entregable', 'hito', 'soporte']

export function colorHito(h: TimelineHito): string {
  if (h.tiene_pago) return 'var(--tl-pago)'
  if (h.tipo === 'soporte') return 'var(--tl-soporte)'
  return 'var(--tl-entregable)'
}

/** Posiciones X del eje. Si hay un hito lejano (soporte), comprime el último tramo. */
export function posicionesEje(
  hitos: TimelineHito[],
  x0: number,
  x1: number,
): { x: number; jumpFromPrev: boolean }[] {
  const n = hitos.length
  if (n === 0) return []

  const dias = hitos.map(h => h.momento_dia)
  const todosConDia = dias.every(d => d != null && Number.isFinite(d) && d >= 0)

  if (!todosConDia) {
    return hitos.map((_, i) => ({
      x: x0 + ((i + 1) / (n + 1)) * (x1 - x0),
      jumpFromPrev: false,
    }))
  }

  const d = dias as number[]
  const min = Math.min(...d)
  const max = Math.max(...d)

  let compressLast = false
  if (n >= 2) {
    const last = d[n - 1]
    const pen = d[n - 2]
    const spanRest = Math.max(1, pen - d[0])
    if (last > pen * 1.8 && last - pen > spanRest * 0.9) {
      compressLast = true
    }
  }

  if (!compressLast) {
    const span = Math.max(1, max - min)
    return d.map(di => ({
      x: x0 + ((di - min) / span) * (x1 - x0),
      jumpFromPrev: false,
    }))
  }

  const pen = d[n - 2]
  const span = Math.max(1, pen - min)
  const xPen = x0 + 0.78 * (x1 - x0)
  return d.map((di, i) => {
    if (i === n - 1) return { x: x1, jumpFromPrev: true }
    return {
      x: x0 + ((di - min) / span) * (xPen - x0),
      jumpFromPrev: false,
    }
  })
}

function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const clean = (text || '').trim() || '—'
  const words = clean.split(/\s+/)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (next.length > maxChars && cur) {
      lines.push(cur)
      cur = w
      if (lines.length >= maxLines) break
    } else {
      cur = next
    }
  }
  if (lines.length < maxLines && cur) lines.push(cur)
  const out = lines.slice(0, maxLines)
  const used = out.join(' ').length
  if (used < clean.length && out.length) {
    const last = out[out.length - 1]
    out[out.length - 1] = last.length > 3 ? `${last.slice(0, Math.max(1, last.length - 1))}…` : `${last}…`
  }
  return out
}

function normalizar(raw: TimelineHito, i: number): TimelineHito {
  const tipo = TIPOS.includes(raw.tipo) ? raw.tipo : 'hito'
  return {
    orden: Number.isFinite(raw.orden) ? raw.orden : i + 1,
    nombre: (raw.nombre || '').trim() || `Hito ${i + 1}`,
    tipo,
    momento_texto: (raw.momento_texto || '').trim() || '',
    momento_dia: raw.momento_dia ?? null,
    tiene_pago: !!raw.tiene_pago,
    pago_texto: raw.pago_texto ?? null,
    pago_momento: raw.pago_momento ?? null,
    es_critico: !!raw.es_critico,
    nota_critica: raw.nota_critica ?? null,
  }
}

function zigzag(xFrom: number, xTo: number, y: number): string {
  const mid = (xFrom + xTo) / 2
  return `M ${xFrom} ${y} L ${mid - 10} ${y} L ${mid - 5} ${y - 7} L ${mid + 5} ${y + 7} L ${mid + 10} ${y} L ${xTo} ${y}`
}

export function TimelineFishbone({
  hitos,
  compact = false,
  isDark: _isDark,
}: {
  hitos: TimelineHito[]
  compact?: boolean
  isDark?: boolean
}) {
  const uid = useId().replace(/:/g, '')
  const sorted = [...hitos]
    .map(normalizar)
    .sort((a, b) => a.orden - b.orden || (a.momento_dia ?? 0) - (b.momento_dia ?? 0))

  if (!sorted.length) return null

  const W = compact ? 900 : Math.max(960, 160 + sorted.length * 170)
  const H = compact ? 208 : 340
  const padL = 72
  const padR = 56
  const x0 = padL
  const x1 = W - padR
  const axisY = compact ? 118 : 168
  const boxW = compact ? 118 : 152
  const boxH = compact ? 48 : 66
  const stem = compact ? 22 : 34
  const maxChars = compact ? 16 : 22
  const fontTitle = compact ? 9 : 11
  const fontSub = compact ? 8 : 9.5
  const rBase = compact ? 11 : 13

  const pos = posicionesEje(sorted, x0, x1)
  const xs = pos.map(p => p.x)

  const boxX = (x: number) => Math.max(boxW / 2 + 6, Math.min(W - boxW / 2 - 6, x))

  const staggerUp = (i: number): number => {
    const closePrev = i > 0 && Math.abs(xs[i] - xs[i - 1]) < boxW + 8
    const closeNext = i < xs.length - 1 && Math.abs(xs[i + 1] - xs[i]) < boxW + 8
    if (!closePrev && !closeNext) return 0
    return i % 2 === 0 ? -20 : 12
  }

  const jumpIdx = pos.findIndex(p => p.jumpFromPrev)
  const criticas = sorted
    .filter(h => h.es_critico)
    .map(h => ({
      nombre: h.nombre,
      nota: (h.nota_critica || '').trim() || `Hito crítico: ${h.nombre}`,
    }))

  return (
    <div className="w-full">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          style={{ minWidth: compact ? 560 : 720 }}
          role="img"
          aria-label="Línea de tiempo de hitos del contrato"
        >
          <defs>
            <marker
              id={`tl-arrow-${uid}`}
              markerWidth="10"
              markerHeight="8"
              refX="9"
              refY="4"
              orient="auto"
            >
              <path d="M0,0 L10,4 L0,8 Z" fill="var(--tl-axis)" />
            </marker>
          </defs>

          {jumpIdx > 0 ? (
            <>
              <line
                x1={x0}
                y1={axisY}
                x2={xs[jumpIdx - 1]}
                y2={axisY}
                stroke="var(--tl-axis)"
                strokeWidth={2}
              />
              <path
                d={zigzag(xs[jumpIdx - 1], xs[jumpIdx], axisY)}
                fill="none"
                stroke="var(--tl-axis)"
                strokeWidth={2}
                strokeDasharray="4 4"
              />
              <text
                x={(xs[jumpIdx - 1] + xs[jumpIdx]) / 2}
                y={axisY - 12}
                textAnchor="middle"
                fill="var(--text-secondary)"
                fontSize={8}
              >
                salto de plazo
              </text>
            </>
          ) : (
            <line
              x1={x0}
              y1={axisY}
              x2={x1}
              y2={axisY}
              stroke="var(--tl-axis)"
              strokeWidth={2}
              markerEnd={`url(#tl-arrow-${uid})`}
            />
          )}
          {jumpIdx > 0 && (
            <line
              x1={xs[jumpIdx]}
              y1={axisY}
              x2={x1 + 12}
              y2={axisY}
              stroke="var(--tl-axis)"
              strokeWidth={2}
              markerEnd={`url(#tl-arrow-${uid})`}
            />
          )}

          {sorted.map((h, i) => {
            const x = xs[i]
            const color = colorHito(h)
            const r = h.tiene_pago || h.es_critico ? rBase + 2 : rBase
            const bx = boxX(x)
            const dy = staggerUp(i)
            const topY = axisY - stem - boxH + dy
            const pagoTxt = (h.pago_texto || '').trim() || 'Pago'
            const nombreLines = wrapText(h.nombre, maxChars, 2)
            const strokeBox = h.es_critico ? 'var(--tl-critico)' : color
            const strokeW = h.es_critico ? 2 : 1.2

            return (
              <g key={`${h.orden}-${i}`}>
                <line
                  x1={x}
                  y1={topY + boxH}
                  x2={x}
                  y2={axisY - r}
                  stroke={color}
                  strokeWidth={1.5}
                />
                <rect
                  x={bx - boxW / 2}
                  y={topY}
                  width={boxW}
                  height={boxH}
                  rx={8}
                  fill={color}
                  fillOpacity={0.14}
                  stroke={strokeBox}
                  strokeWidth={strokeW}
                />
                {nombreLines.map((line, li) => (
                  <text
                    key={li}
                    x={bx}
                    y={topY + 16 + li * (fontTitle + 3)}
                    textAnchor="middle"
                    fill="var(--text-primary)"
                    fontSize={fontTitle}
                    fontWeight={500}
                  >
                    {line}
                  </text>
                ))}
                {h.momento_texto && (
                  <text
                    x={bx}
                    y={topY + boxH - 10}
                    textAnchor="middle"
                    fill="var(--text-secondary)"
                    fontSize={fontSub}
                  >
                    {h.momento_texto}
                  </text>
                )}
                {h.es_critico && (
                  <text
                    x={bx + boxW / 2 - 10}
                    y={topY + 12}
                    fill="var(--tl-critico)"
                    fontSize={10}
                  >
                    ⚠
                  </text>
                )}

                {h.tiene_pago && (
                  <>
                    <line
                      x1={x}
                      y1={axisY + r}
                      x2={x}
                      y2={axisY + stem}
                      stroke="var(--tl-pago)"
                      strokeWidth={1.5}
                    />
                    <rect
                      x={bx - boxW / 2}
                      y={axisY + stem}
                      width={boxW}
                      height={boxH - (compact ? 4 : 0)}
                      rx={8}
                      fill="var(--tl-pago)"
                      fillOpacity={0.14}
                      stroke="var(--tl-pago)"
                      strokeWidth={1.2}
                    />
                    <text
                      x={bx}
                      y={axisY + stem + 18}
                      textAnchor="middle"
                      fill="var(--text-primary)"
                      fontSize={fontTitle}
                      fontWeight={500}
                    >
                      {wrapText(pagoTxt, maxChars, 1)[0]}
                    </text>
                    {h.pago_momento && (
                      <text
                        x={bx}
                        y={axisY + stem + (compact ? 34 : 38)}
                        textAnchor="middle"
                        fill="var(--text-secondary)"
                        fontSize={fontSub}
                      >
                        {wrapText(h.pago_momento, maxChars, 1)[0]}
                      </text>
                    )}
                  </>
                )}

                <circle
                  cx={x}
                  cy={axisY}
                  r={r}
                  fill="var(--bg-card)"
                  stroke={color}
                  strokeWidth={2.5}
                />
                {h.es_critico && (
                  <circle
                    cx={x}
                    cy={axisY}
                    r={r + 4}
                    fill="none"
                    stroke="var(--tl-critico)"
                    strokeWidth={1.5}
                  />
                )}
                <text
                  x={x}
                  y={axisY + 4}
                  textAnchor="middle"
                  fill="var(--text-primary)"
                  fontSize={compact ? 10 : 11}
                  fontWeight={600}
                >
                  {h.orden || i + 1}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {!compact && (
        <>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--text-secondary)]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--tl-entregable)' }} />
              Entregable / hito
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--tl-pago)' }} />
              Hito con pago
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--tl-soporte)' }} />
              Soporte
            </span>
          </div>
          {criticas.length > 0 && (
            <div className="mt-3 space-y-2">
              {criticas.map((c, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-200"
                >
                  <span className="mr-1">⚠</span>
                  <span className="font-medium">{c.nombre}.</span> {c.nota}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export function TimelineCard({ timeline }: { timeline: Timeline }) {
  const [open, setOpen] = useState(false)
  const hitos = (timeline.hitos ?? []).map(normalizar)
  if (!hitos.length) return null
  const dur = (timeline.duracion_total_texto || '').trim()

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 text-left hover:border-teal-400"
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium">Línea de tiempo</p>
            {dur && <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">{dur}</p>}
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]">
            <Maximize2 className="h-3 w-3" /> Ver completa ⤢
          </span>
        </div>
        <TimelineFishbone hitos={hitos} compact />
      </button>

      <Modal wide open={open} onClose={() => setOpen(false)} title="Línea de tiempo">
        {dur && <p className="mb-3 text-sm text-[var(--text-secondary)]">{dur}</p>}
        <TimelineFishbone hitos={hitos} compact={false} />
      </Modal>
    </>
  )
}

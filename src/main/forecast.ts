import type { Confidence, Forecast } from '../shared/types.ts'

export interface Point {
  ts: number // epoch ms
  pct: number
}

const HOUR = 3600_000
/** Janela de observação do ritmo recente. */
export const FORECAST_LOOKBACK_MS = 90 * 60_000

/**
 * Estimativa de esgotamento da janela de 5h por regressão linear do percentual no tempo,
 * usando só amostras da janela atual (mesmo reset). É estimativa local, não dado da Anthropic.
 */
export function forecast(points: Point[], resetsAt: number, now: number): Forecast | null {
  const pts = points.filter((p) => p.ts >= now - FORECAST_LOOKBACK_MS && p.ts <= now)
  if (pts.length < 2) return null
  const span = pts[pts.length - 1].ts - pts[0].ts
  if (span < 5 * 60_000) return null

  const n = pts.length
  const mx = pts.reduce((a, p) => a + p.ts, 0) / n
  const my = pts.reduce((a, p) => a + p.pct, 0) / n
  let num = 0
  let den = 0
  for (const p of pts) {
    num += (p.ts - mx) * (p.pct - my)
    den += (p.ts - mx) ** 2
  }
  const slopePerMs = den === 0 ? 0 : num / den
  const ratePerHour = Math.max(0, slopePerMs * HOUR)

  const last = pts[n - 1]
  let exhaustAt: number | null = null
  if (ratePerHour >= 0.5) {
    const remaining = Math.max(0, 100 - last.pct)
    exhaustAt = Math.round(last.ts + (remaining / ratePerHour) * HOUR)
  }

  const confidence: Confidence =
    n >= 10 && span >= 45 * 60_000 ? 'alta' : n >= 5 && span >= 20 * 60_000 ? 'média' : 'baixa'

  return {
    exhaustAt,
    ratePerHour: Math.round(ratePerHour * 10) / 10,
    confidence,
    beforeReset: exhaustAt !== null && exhaustAt < resetsAt,
    samples: n
  }
}

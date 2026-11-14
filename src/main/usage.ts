import { readdirSync, readFileSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import type { LimitWindow, Usage } from '../shared/types.ts'
import type { CliUsage } from './claude-cli.ts'
import type { LocalStore } from './db.ts'
import { FORECAST_LOOKBACK_MS, forecast } from './forecast.ts'
import { STATUSLINE_DIR } from './paths.ts'
import type { ParsedWindow } from './usage-text.ts'

/** Recorte do JSON que o Claude Code entrega à statusline. */
export interface StatuslinePayload {
  session_id: string
  session_name?: string
  cwd?: string
  model?: { id?: string; display_name?: string }
  cost?: { total_lines_added?: number; total_lines_removed?: number }
  rate_limits?: {
    five_hour?: { used_percentage?: number; resets_at?: number }
    seven_day?: { used_percentage?: number; resets_at?: number }
  }
}

export interface StatuslineScan {
  /** Leitura mais recente que trouxe rate_limits. */
  latest: { payload: StatuslinePayload; mtime: number } | null
  bySession: Map<string, StatuslinePayload>
}

const RETENTION_MS = 7 * 24 * 3600_000
const SESSION_WINDOW_MS = 24 * 3600_000

const parseCache = new Map<string, { mtime: number; payload: StatuslinePayload | null }>()

function parse(file: string, mtime: number): StatuslinePayload | null {
  const hit = parseCache.get(file)
  if (hit && hit.mtime === mtime) return hit.payload
  let payload: StatuslinePayload | null = null
  try {
    payload = JSON.parse(readFileSync(file, 'utf8')) as StatuslinePayload
  } catch {
    /* arquivo em escrita; tenta no próximo ciclo */
  }
  parseCache.set(file, { mtime, payload })
  return payload
}

export function scanStatusline(accountId: string, now: number): StatuslineScan {
  const dir = join(STATUSLINE_DIR, accountId)
  const result: StatuslineScan = { latest: null, bySession: new Map() }
  let names: string[]
  try {
    names = readdirSync(dir).filter((n) => n.endsWith('.json') && !n.startsWith('.'))
  } catch {
    return result
  }
  const files = names
    .map((n) => {
      const file = join(dir, n)
      try {
        return { file, mtime: statSync(file).mtimeMs }
      } catch {
        return null
      }
    })
    .filter((f): f is { file: string; mtime: number } => f !== null)
    .sort((a, b) => b.mtime - a.mtime)

  for (const f of files) {
    if (now - f.mtime > RETENTION_MS) {
      // Pasta do próprio Orbit: limpa cópias de sessões antigas.
      try {
        unlinkSync(f.file)
      } catch {
        /* ignora */
      }
      parseCache.delete(f.file)
      continue
    }
    const fresh = now - f.mtime < SESSION_WINDOW_MS
    if (!fresh && result.latest) continue
    const p = parse(f.file, f.mtime)
    if (!p) continue
    if (fresh) result.bySession.set(p.session_id, p)
    if (!result.latest && p.rate_limits?.five_hour) result.latest = { payload: p, mtime: f.mtime }
  }
  return result
}

function toWindow(w: { used_percentage?: number; resets_at?: number } | undefined, now: number): LimitWindow | null {
  if (!w || typeof w.resets_at !== 'number') return null
  const resetsAt = w.resets_at * 1000
  const renewed = resetsAt <= now
  // Depois do reset não sabemos o uso novo até chegar outra leitura: não inventamos.
  return { usedPercent: renewed ? null : (w.used_percentage ?? null), resetsAt, renewed }
}

function fromCli(w: ParsedWindow | null, now: number): LimitWindow | null {
  if (!w) return null
  const renewed = w.resetsAt !== null && w.resetsAt <= now
  return { usedPercent: renewed ? null : w.usedPercent, resetsAt: w.resetsAt, renewed }
}

/** Agrupa leituras da mesma janela: statusline e /usage arredondam o reset de formas diferentes. */
const windowKey = (resetsAt: number) => Math.round(resetsAt / 300_000) * 300_000

/**
 * Junta as duas fontes oficiais: a statusline (tempo real, só com sessão aberta) e o /usage
 * (o Orbit roda de tempos em tempos; inclui uso do claude.ai). Vale a leitura mais recente.
 */
export function buildUsage(
  accountId: string,
  scan: StatuslineScan,
  cli: CliUsage | null,
  store: LocalStore,
  now: number
): Usage {
  const slAt = scan.latest ? Math.round(scan.latest.mtime) : 0
  const cliAt = cli?.ok ? cli.at : 0
  if (!slAt && !cliAt) return { fiveHour: null, sevenDay: null, observedAt: null, source: null, forecast: null }

  let fiveHour: LimitWindow | null
  let sevenDay: LimitWindow | null
  let observedAt: number
  let source: Usage['source']
  if (slAt >= cliAt) {
    const rl = scan.latest!.payload.rate_limits!
    fiveHour = toWindow(rl.five_hour, now)
    sevenDay = toWindow(rl.seven_day, now)
    observedAt = slAt
    source = 'statusline'
  } else {
    fiveHour = fromCli(cli!.fiveHour, now)
    sevenDay = fromCli(cli!.sevenDay, now)
    observedAt = cliAt
    source = 'usage'
  }

  if (fiveHour?.resetsAt && !fiveHour.renewed && fiveHour.usedPercent !== null) {
    store.addSample(accountId, {
      ts: observedAt,
      five_pct: fiveHour.usedPercent,
      five_reset: windowKey(fiveHour.resetsAt),
      week_pct: sevenDay?.usedPercent ?? null,
      week_reset: sevenDay?.resetsAt ?? null
    })
  }

  let fc = null
  if (fiveHour?.resetsAt && !fiveHour.renewed) {
    const pts = store
      .samples(accountId, windowKey(fiveHour.resetsAt), now - FORECAST_LOOKBACK_MS)
      .map((s) => ({ ts: s.ts, pct: s.five_pct }))
    fc = forecast(pts, fiveHour.resetsAt, now)
  }
  return { fiveHour, sevenDay, observedAt, source, forecast: fc }
}

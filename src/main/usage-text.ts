/**
 * Lê o texto do comando /usage do Claude Code:
 *   Current session: 70% used · resets Nov 14 at 3:39pm (America/Sao_Paulo)
 *   Current week (all models): 9% used · resets Nov 21 at 2:59am (America/Sao_Paulo)
 *   Current session: 0% used                      ← janela ainda não iniciada
 * O texto não é um formato estável: o que não for reconhecido vira null, nunca um valor inventado.
 */

export interface ParsedWindow {
  usedPercent: number
  resetsAt: number | null
}
export interface ParsedUsage {
  fiveHour: ParsedWindow | null
  sevenDay: ParsedWindow | null
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const DAY = 24 * 3600_000

/** Diferença (ms) entre o relógio de `tz` e UTC no instante `ts`. */
function tzOffset(ts: number, tz: string | null): number {
  if (!tz) return -new Date(ts).getTimezoneOffset() * 60_000
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).formatToParts(new Date(ts))
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'))
    return asUtc - Math.floor(ts / 60_000) * 60_000
  } catch {
    return -new Date(ts).getTimezoneOffset() * 60_000
  }
}

function zoned(y: number, mo: number, d: number, h: number, mi: number, tz: string | null): number {
  const guess = Date.UTC(y, mo, d, h, mi)
  let t = guess - tzOffset(guess, tz)
  const again = guess - tzOffset(t, tz) // corrige perto de troca de horário de verão
  if (again !== t) t = again
  return t
}

/** "resets Nov 21 at 2:59am (America/Sao_Paulo)" ou "resets 3:39pm (...)" → epoch ms. */
export function parseReset(text: string, now: number): number | null {
  const m = text.match(
    /resets\s+(?:([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})(?:,?\s+\d{4})?\s+(?:at\s+)?)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?(?:\s*\(([^)]+)\))?/i
  )
  if (!m) return null
  const [, mon, day, hh, mm, ampm, tz] = m
  let hour = Number(hh)
  if (ampm) {
    hour %= 12
    if (ampm.toLowerCase() === 'pm') hour += 12
  }
  const minute = mm ? Number(mm) : 0
  const zone = tz?.trim() || null
  const off = tzOffset(now, zone)
  const local = new Date(now + off) // campos UTC deste Date = relógio do fuso
  let year = local.getUTCFullYear()

  if (mon) {
    const month = MONTHS.indexOf(mon.toLowerCase())
    if (month < 0) return null
    let t = zoned(year, month, Number(day), hour, minute, zone)
    if (t < now - DAY) t = zoned(++year, month, Number(day), hour, minute, zone)
    return t
  }
  let t = zoned(year, local.getUTCMonth(), local.getUTCDate(), hour, minute, zone)
  if (t < now - 60_000) t += DAY
  return t
}

function windowFrom(text: string, label: RegExp, now: number): ParsedWindow | null {
  const line = text.split('\n').find((l) => label.test(l))
  if (!line) return null
  const pct = line.match(/(\d+(?:\.\d+)?)\s*%\s*used/i)
  if (!pct) return null
  return { usedPercent: Math.round(Number(pct[1])), resetsAt: /resets/i.test(line) ? parseReset(line, now) : null }
}

export function parseUsageText(text: string, now: number): ParsedUsage {
  return {
    fiveHour: windowFrom(text, /^\s*current session\b/i, now),
    sevenDay: windowFrom(text, /^\s*current week \(all models\)/i, now) ?? windowFrom(text, /^\s*current week\b/i, now)
  }
}

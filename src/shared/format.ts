import { STATE_PRIORITY, type Session, type SessionState } from './types.ts'

export const STATE_LABEL: Record<SessionState, string> = {
  working: 'Trabalhando',
  thinking: 'Pensando',
  waiting: 'Aguardando',
  approval: 'Aprovação',
  completed: 'Concluído',
  error: 'Erro',
  idle: 'Inativo'
}

/** Cor do status na menu bar: verde trabalhando, amarelo aguardando intervenção, vermelho erro, cinza inativo. */
export type StatusTone = 'green' | 'yellow' | 'red' | 'gray'
export const STATE_TONE: Record<SessionState, StatusTone> = {
  working: 'green',
  thinking: 'green',
  waiting: 'yellow',
  approval: 'yellow',
  completed: 'gray',
  error: 'red',
  idle: 'gray'
}

export function rank(s: SessionState): number {
  return STATE_PRIORITY.indexOf(s)
}

/** A sessão que mais importa agora: estado mais urgente, depois a mais recente. */
export function mostRelevant(sessions: Session[]): Session | null {
  return (
    [...sessions].sort((a, b) => rank(a.state) - rank(b.state) || b.updatedAt - a.updatedAt)[0] ?? null
  )
}

export function overallState(sessions: Session[]): SessionState {
  return mostRelevant(sessions)?.state ?? 'idle'
}

/** "2h 14m", "14m", "3 dias". */
export function formatRemaining(ms: number): string {
  if (ms <= 0) return 'agora'
  const min = Math.floor(ms / 60_000)
  if (min < 1) return '<1m'
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h ${String(min % 60).padStart(2, '0')}m`
  const d = Math.floor(h / 24)
  const rh = h % 24
  return rh ? `${d}d ${rh}h` : `${d} ${d === 1 ? 'dia' : 'dias'}`
}

/** Contador de execução: "00:42" (min:s) ou "1:05:09". */
export function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(sec).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

export function formatClock(ts: number, now = Date.now()): string {
  const d = new Date(ts)
  const hm = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const sameDay = new Date(now).toDateString() === d.toDateString()
  if (sameDay) return hm
  return `${d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }).replace('.', '')} ${hm}`
}

export function formatAgo(ts: number, now = Date.now()): string {
  const ms = now - ts
  if (ms < 60_000) return 'agora'
  return `há ${formatRemaining(ms)}`
}

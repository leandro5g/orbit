import { STATE_LABEL, STATE_TONE } from '../../../shared/format'
import type { SessionState } from '../../../shared/types'
import { Code } from '../icons'

export function Dot({ state }: { state: SessionState }) {
  return <span className={`dot tone-${STATE_TONE[state]} ${state === 'working' || state === 'thinking' ? 'pulse' : ''}`} />
}

export function StatePill({ state }: { state: SessionState }) {
  return (
    <span className={`pill tone-${STATE_TONE[state]}`}>
      {state === 'working' || state === 'thinking' ? <Code /> : <span className={`dot tone-${STATE_TONE[state]}`} />}
      {STATE_LABEL[state]}
    </span>
  )
}

/** Verde até 70%, âmbar até 90%, vermelho acima. */
export function usageTone(pct: number | null | undefined): 'green' | 'yellow' | 'red' {
  if (pct == null || pct < 70) return 'green'
  return pct < 90 ? 'yellow' : 'red'
}

export function Bar({ pct, tone }: { pct: number | null; tone: 'green' | 'yellow' | 'red' | 'purple' | 'gray' }) {
  return (
    <div className="bar" role="progressbar" aria-valuenow={pct ?? undefined} aria-valuemin={0} aria-valuemax={100}>
      <div className={`bar-fill fill-${tone}`} style={{ width: `${Math.min(100, Math.max(0, pct ?? 0))}%` }} />
    </div>
  )
}

export function Spinner() {
  return <span className="spinner" aria-label="em execução" />
}

export function Lines({ added, removed }: { added: number | null; removed: number | null }) {
  if (added == null && removed == null) return null
  return (
    <span className="lines">
      <span className="plus">+{added ?? 0}</span> <span className="minus">−{removed ?? 0}</span>
    </span>
  )
}

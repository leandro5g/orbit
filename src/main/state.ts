import type { SessionState } from '../shared/types.ts'

/** Último evento de hook gravado por ~/.orbit/hook.sh. */
export interface HookEvent {
  event: string
  tool: string
  notification: string
  ts: number // epoch s
}

export interface Derived {
  state: SessionState
  since: number
  tool: string | null
}

const COMPLETED_FOR_MS = 10 * 60_000
const ERROR_FOR_MS = 30 * 60_000

function fromHook(h: HookEvent, turnStart: number | null, now: number): Derived | null {
  const at = h.ts * 1000
  const turn = turnStart ?? at
  switch (h.event) {
    case 'UserPromptSubmit':
      return { state: 'thinking', since: at, tool: null }
    case 'PreToolUse':
    case 'PostToolUse':
    case 'PostToolUseFailure':
    case 'SubagentStop':
      return { state: 'working', since: turn, tool: h.tool || null }
    case 'PermissionRequest':
      return { state: 'approval', since: at, tool: h.tool || null }
    case 'Notification':
      if (h.notification === 'permission_prompt' || h.notification === 'elicitation_dialog')
        return { state: 'approval', since: at, tool: null }
      if (h.notification === 'idle_prompt') return { state: 'waiting', since: at, tool: null }
      return null
    case 'Stop':
      return now - at < COMPLETED_FOR_MS
        ? { state: 'completed', since: at, tool: null }
        : { state: 'idle', since: at, tool: null }
    case 'StopFailure':
      return now - at < ERROR_FOR_MS ? { state: 'error', since: at, tool: null } : { state: 'idle', since: at, tool: null }
    case 'SessionStart':
      return { state: 'idle', since: at, tool: null }
    default:
      return null
  }
}

function fromStatus(status: string | undefined, since: number): Derived {
  if (status === 'busy') return { state: 'working', since, tool: null }
  if (!status || status === 'idle') return { state: 'idle', since, tool: null }
  // Qualquer outro estado do Claude Code (ex.: esperando entrada) conta como aguardando.
  return { state: 'waiting', since, tool: null }
}

/**
 * Combina o status que o Claude Code grava em <config>/sessions/<pid>.json (busy/idle)
 * com o último hook. O hook é mais rico (ferramenta, permissão, erro), então vence quando é
 * mais recente; quando a sessão volta a idle logo após um Stop/StopFailure, o hook explica o porquê.
 */
export function deriveState(
  status: string | undefined,
  statusSince: number,
  hook: HookEvent | null,
  turnStart: number | null,
  now: number
): Derived {
  const base = fromStatus(status, statusSince)
  if (!hook) return base
  const hookAt = hook.ts * 1000
  const fromH = fromHook(hook, turnStart, now)
  if (!fromH) return base

  const hookIsNewer = hookAt >= statusSince - 1500
  const terminal = hook.event === 'Stop' || hook.event === 'StopFailure' || hook.event === 'Notification'
  if (hookIsNewer) return fromH
  if (base.state === 'idle' && terminal && statusSince - hookAt < 60_000) return fromH
  if (base.state === 'working' && status === 'busy') {
    // Status busy mais novo que o hook: segue trabalhando, mas aproveita a ferramenta/início do turno.
    return { state: 'working', since: turnStart ?? statusSince, tool: fromH.state === 'working' ? fromH.tool : null }
  }
  return base
}

import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ActionResult, Integration } from '../shared/types.ts'
import { HOOK_SCRIPT, ORBIT_DIR, STATUSLINE_SCRIPT } from './paths.ts'

/**
 * Integração com o Claude Code, só por mecanismos documentados:
 * - statusLine: o Claude Code entrega um JSON com rate_limits (5h e 7 dias), modelo, custo e linhas.
 *   O script grava uma cópia por sessão em ~/.orbit/statusline/<conta>/<session_id>.json.
 * - hooks: eventos de turno (prompt, ferramenta, permissão, fim, erro) em ~/.orbit/events/<session_id>.json.
 * Nenhum dos dois imprime nada nem guarda o texto do prompt.
 */

const STATUSLINE_BODY = `#!/bin/sh
# Orbit: guarda o JSON que o Claude Code entrega à statusline, uma cópia por sessão, em
#   ~/.orbit/statusline/<conta>/<session_id>.json
# A conta vem de CLAUDE_CONFIG_DIR; sem ele, é a conta padrão (~/.claude).
# Não imprime nada: a statusline fica em branco.

dir="\${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
account=$(basename "$dir" | sed 's/^\\.//')
out="$HOME/.orbit/statusline/$account"

payload=$(cat)
id=$(printf '%s' "$payload" | grep -o '"session_id" *: *"[^"]*"' | head -n 1 | sed 's/.*"\\([^"]*\\)"$/\\1/')
[ -n "$id" ] || exit 0

mkdir -p "$out" 2>/dev/null || exit 0
tmp="$out/.$id.tmp"
printf '%s' "$payload" > "$tmp" && mv "$tmp" "$out/$id.json"
exit 0
`

const HOOK_BODY = `#!/bin/sh
# Orbit: registra o último evento de cada sessão do Claude Code em ~/.orbit/events/<session_id>.json.
# Guarda só o nome do evento, a ferramenta e o tipo de notificação. Nunca o prompt.
# Sempre sai com 0 e sem saída, para não interferir no Claude Code.

payload=$(cat)
field() {
  printf '%s' "$payload" | grep -o "\\"$1\\" *: *\\"[^\\"]*\\"" | head -n 1 | sed 's/.*"\\([^"]*\\)"$/\\1/'
}
sid=$(field session_id)
[ -n "$sid" ] || exit 0
event=$(field hook_event_name)
tool=$(field tool_name)
ntype=$(field notification_type)
account=$(basename "\${CLAUDE_CONFIG_DIR:-$HOME/.claude}" | sed 's/^\\.//')
ts=$(date +%s)

out="$HOME/.orbit/events"
mkdir -p "$out" 2>/dev/null || exit 0
tmp="$out/.$sid.tmp"
printf '{"event":"%s","tool":"%s","notification":"%s","account":"%s","ts":%s}' \\
  "$event" "$tool" "$ntype" "$account" "$ts" > "$tmp" && mv "$tmp" "$out/$sid.json"
if [ "$event" = "UserPromptSubmit" ]; then
  printf '%s' "$ts" > "$out/.$sid.turn"
fi
exit 0
`

export const HOOK_EVENTS = [
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'PermissionRequest',
  'Notification',
  'Stop',
  'StopFailure',
  'SessionEnd'
] as const

interface HookEntry {
  matcher?: string
  hooks?: { type: string; command?: string }[]
}
interface ClaudeSettings {
  statusLine?: { type?: string; command?: string }
  hooks?: Record<string, HookEntry[]>
  [k: string]: unknown
}

function settingsPath(configDir: string): string {
  return join(configDir, 'settings.json')
}

function readSettings(configDir: string): ClaudeSettings | null {
  try {
    return JSON.parse(readFileSync(settingsPath(configDir), 'utf8')) as ClaudeSettings
  } catch {
    return null
  }
}

const isOurs = (cmd: string | undefined, script: string) =>
  !!cmd && (cmd.includes(script) || cmd.includes(script.replace(/^.*\/\.orbit\//, '.orbit/')))

export function detectIntegration(configDir: string): Integration {
  const s = readSettings(configDir)
  const cmd = s?.statusLine?.command
  const statusline = isOurs(cmd, STATUSLINE_SCRIPT) && existsSync(STATUSLINE_SCRIPT)
  const hooks =
    existsSync(HOOK_SCRIPT) &&
    HOOK_EVENTS.every((ev) => (s?.hooks?.[ev] ?? []).some((e) => e.hooks?.some((h) => isOurs(h.command, HOOK_SCRIPT))))
  return { statusline, hooks, statuslineConflict: cmd && !statusline && !isOurs(cmd, STATUSLINE_SCRIPT) ? cmd : null }
}

function ensureScript(path: string, body: string, overwrite: boolean): void {
  mkdirSync(ORBIT_DIR, { recursive: true, mode: 0o700 })
  if (overwrite || !existsSync(path)) writeFileSync(path, body, { mode: 0o755 })
  chmodSync(path, 0o755)
}

/**
 * Instala statusline e hooks no settings.json da conta, com backup. Idempotente.
 * Não substitui uma statusline de terceiros: avisa e deixa a decisão com o usuário.
 */
export function installIntegration(configDir: string): ActionResult {
  const file = settingsPath(configDir)
  let real = file
  try {
    real = realpathSync(file)
  } catch {
    /* settings.json ainda não existe */
  }
  const current = existsSync(real) ? readSettings(configDir) : {}
  if (current === null) return { ok: false, message: `Não consegui ler ${real} (JSON inválido). Nada foi alterado.` }

  ensureScript(STATUSLINE_SCRIPT, STATUSLINE_BODY, false)
  ensureScript(HOOK_SCRIPT, HOOK_BODY, true)

  const next: ClaudeSettings = structuredClone(current)
  const notes: string[] = []

  const cmd = next.statusLine?.command
  if (!cmd) next.statusLine = { type: 'command', command: STATUSLINE_SCRIPT }
  else if (!isOurs(cmd, STATUSLINE_SCRIPT))
    notes.push(`a statusline atual ("${cmd}") foi mantida; sem a do Orbit não há leitura dos limites`)

  next.hooks ??= {}
  for (const ev of HOOK_EVENTS) {
    const list = (next.hooks[ev] ??= [])
    if (!list.some((e) => e.hooks?.some((h) => isOurs(h.command, HOOK_SCRIPT))))
      list.push({ hooks: [{ type: 'command', command: HOOK_SCRIPT }] })
  }

  if (JSON.stringify(next) !== JSON.stringify(current)) {
    if (existsSync(real)) copyFileSync(real, `${real}.orbit-bak-${Date.now()}`)
    writeFileSync(real, JSON.stringify(next, null, 2) + '\n')
  }
  const base = `Integração instalada em ${real}. Vale para sessões novas do Claude Code.`
  return { ok: notes.length === 0, message: notes.length ? `${base} Atenção: ${notes.join('; ')}.` : base }
}

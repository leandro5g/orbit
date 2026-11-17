import { homedir } from 'node:os'
import { basename, join } from 'node:path'

export const HOME = homedir()
export const ORBIT_DIR = join(HOME, '.orbit')
export const STATUSLINE_DIR = join(ORBIT_DIR, 'statusline')
export const EVENTS_DIR = join(ORBIT_DIR, 'events')
export const STATUSLINE_SCRIPT = join(ORBIT_DIR, 'statusline.sh')
export const HOOK_SCRIPT = join(ORBIT_DIR, 'hook.sh')
/** Pedidos de registro de continuação, um arquivo por sessão; o hook.sh entrega ao Claude no fim do turno. */
export const HANDOFF_DIR = join(ORBIT_DIR, 'handoff')
export const DEFAULT_CONFIG_DIR = join(HOME, '.claude')

/**
 * Id da conta = nome da pasta de configuração sem o ponto (~/.claude → "claude",
 * ~/.claude-work → "claude-work"). É a mesma regra do statusline.sh e do hook.sh,
 * que usam CLAUDE_CONFIG_DIR.
 */
export function accountIdFor(configDir: string): string {
  return basename(configDir).replace(/^\./, '')
}

/** O Claude Code guarda o .claude.json da conta padrão em ~/.claude.json; nas outras, dentro da pasta. */
export function claudeJsonFor(configDir: string): string {
  return configDir === DEFAULT_CONFIG_DIR ? join(HOME, '.claude.json') : join(configDir, '.claude.json')
}

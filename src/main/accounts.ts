import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { Account, Settings } from '../shared/types.ts'
import { launchCommand } from './claude-cli.ts'
import { detectIntegration } from './integration.ts'
import { accountIdFor, claudeJsonFor, DEFAULT_CONFIG_DIR, HOME } from './paths.ts'

/** Uma pasta é conta do Claude Code se tem settings.json ou .claude.json. */
export function looksLikeConfigDir(dir: string): boolean {
  try {
    if (!statSync(dir).isDirectory()) return false
  } catch {
    return false
  }
  return existsSync(join(dir, 'settings.json')) || existsSync(claudeJsonFor(dir))
}

/** ~/.claude, ~/.claude-* e as pastas adicionadas à mão. */
function candidateDirs(settings: Settings): string[] {
  const dirs = new Set<string>([DEFAULT_CONFIG_DIR])
  for (const name of readdirSync(HOME)) if (/^\.claude-[\w.-]+$/.test(name)) dirs.add(join(HOME, name))
  for (const d of settings.extraConfigDirs) dirs.add(d)
  return [...dirs].filter(looksLikeConfigDir)
}

// O .claude.json pode ter vários MB; relemos só quando muda.
const identityCache = new Map<string, { mtime: number; email: string | null; organization: string | null }>()

function identity(configDir: string): { email: string | null; organization: string | null } {
  const file = claudeJsonFor(configDir)
  try {
    const mtime = statSync(file).mtimeMs
    const hit = identityCache.get(file)
    if (hit && hit.mtime === mtime) return hit
    // Lê só a identidade da conta. Tokens não ficam neste arquivo nem são tocados.
    const acc = (JSON.parse(readFileSync(file, 'utf8')) as { oauthAccount?: Record<string, unknown> }).oauthAccount
    const org = typeof acc?.organizationName === 'string' ? acc.organizationName : null
    const email = typeof acc?.emailAddress === 'string' ? acc.emailAddress : null
    const v = { mtime, email, organization: org && !org.includes("'s Organization") ? org : null }
    identityCache.set(file, v)
    return v
  } catch {
    return { email: null, organization: null }
  }
}

export function defaultName(id: string): string {
  if (id === 'claude') return 'Principal'
  const rest = id.replace(/^claude-?/, '') || id
  return rest.charAt(0).toUpperCase() + rest.slice(1)
}

export function discoverAccounts(settings: Settings): Account[] {
  const seen = new Set<string>()
  const out: Account[] = []
  for (const dir of candidateDirs(settings)) {
    const id = accountIdFor(dir)
    if (seen.has(id) || settings.hiddenAccounts.includes(id)) continue
    seen.add(id)
    out.push({
      id,
      configDir: dir,
      name: settings.names[id] || defaultName(id),
      ...identity(dir),
      needsLogin: identity(dir).email === null,
      launchCommand: launchCommand(dir),
      integration: detectIntegration(dir)
    })
  }
  return out
}

import { execFile, spawn } from 'node:child_process'
import { accessSync, constants, chmodSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir, userInfo } from 'node:os'
import { delimiter, join } from 'node:path'
import { DEFAULT_CONFIG_DIR, HOME, ORBIT_DIR } from './paths.ts'
import { parseUsageText, type ParsedUsage } from './usage-text.ts'

/**
 * Tudo o que fala com a Anthropic passa pelo binário oficial do Claude Code, com o login do próprio
 * usuário. O Orbit não vê nem guarda credencial (regra da Anthropic para apps de terceiros).
 */

const isWin = process.platform === 'win32'
const NAMES = isWin ? ['claude.exe', 'claude.cmd'] : ['claude']

function executable(p: string): boolean {
  try {
    accessSync(p, isWin ? constants.F_OK : constants.X_OK)
    return true
  } catch {
    return false
  }
}

/** Apps abertos pelo Finder não herdam o PATH do terminal: procura também nos lugares comuns. */
function candidates(): string[] {
  const dirs = [
    ...(process.env.PATH ?? '').split(delimiter),
    join(HOME, '.local', 'bin'),
    join(HOME, '.claude', 'local'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
    join(HOME, '.npm-global', 'bin'),
    join(HOME, '.bun', 'bin'),
    join(HOME, '.volta', 'bin'),
    join(HOME, 'Library', 'pnpm'),
    join(HOME, '.local', 'share', 'pnpm'),
    ...(isWin ? [join(process.env.APPDATA ?? '', 'npm')] : [])
  ].filter(Boolean)
  return [...new Set(dirs)].flatMap((d) => NAMES.map((n) => join(d, n)))
}

function fromLoginShell(): Promise<string | null> {
  if (isWin) return Promise.resolve(null)
  const shell = process.env.SHELL || '/bin/zsh'
  return new Promise((resolve) =>
    execFile(shell, ['-lc', 'command -v claude'], { timeout: 5000 }, (err, out) => {
      const p = out?.trim().split('\n').pop()
      resolve(!err && p && executable(p) ? p : null)
    })
  )
}

let cached: { override: string | null; path: string | null; at: number } | null = null

export async function findClaude(override: string | null, force = false): Promise<string | null> {
  if (!force && cached && cached.override === override && Date.now() - cached.at < 5 * 60_000) return cached.path
  let path: string | null = null
  if (override && executable(override)) path = override
  else path = candidates().find(executable) ?? (await fromLoginShell())
  cached = { override, path, at: Date.now() }
  return path
}

/** Env do Claude Code para a conta. A conta padrão roda sem CLAUDE_CONFIG_DIR (o .claude.json dela fica em ~). */
function envFor(configDir: string): NodeJS.ProcessEnv {
  const env = { ...process.env }
  // Sem USER o Claude Code não acha o login no Keychain e responde como deslogado.
  const user = userInfo().username
  env.USER ||= user
  env.LOGNAME ||= user
  if (configDir === DEFAULT_CONFIG_DIR) delete env.CLAUDE_CONFIG_DIR
  else env.CLAUDE_CONFIG_DIR = configDir
  return env
}

/** Pids dos `claude -p` do próprio Orbit, para não aparecerem como sessões. */
export const ownPids = new Set<number>()

export interface CliUsage extends ParsedUsage {
  at: number
  ok: boolean
}

/**
 * Roda `/usage` localmente: 0 tokens, ~2 s. Sem hooks, plugins e MCP do usuário (--setting-sources "")
 * e sem gravar sessão no histórico.
 */
export function fetchUsage(claude: string, configDir: string): Promise<CliUsage> {
  const args = ['-p', '/usage', '--setting-sources', '', '--no-session-persistence', '--strict-mcp-config', '--output-format', 'json']
  return new Promise((resolve) => {
    // stdin fechado: com um pipe aberto o `claude -p` espera entrada e responde como se não houvesse login.
    const child = spawn(claude, args, { cwd: tmpdir(), env: envFor(configDir), stdio: ['ignore', 'pipe', 'pipe'] })
    if (child.pid) ownPids.add(child.pid)
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d: Buffer) => (stdout += d.toString()))
    child.stderr.on('data', (d: Buffer) => (stderr += d.toString()))
    const timer = setTimeout(() => child.kill('SIGTERM'), 45_000)
    const fail = (why: string) => {
      console.error(`[orbit] /usage falhou (${configDir}): ${why}`)
      resolve({ at: Date.now(), ok: false, fiveHour: null, sevenDay: null })
    }
    child.on('error', (e) => {
      clearTimeout(timer)
      fail(e.message)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (child.pid) ownPids.delete(child.pid)
      if (code !== 0) return fail(`saída ${code} ${stderr.split('\n')[0]}`)
      const at = Date.now()
      try {
        const result = (JSON.parse(stdout) as { result?: string }).result ?? ''
        const parsed = parseUsageText(result, at)
        resolve({ at, ok: !!(parsed.fiveHour || parsed.sevenDay), ...parsed })
      } catch {
        fail('resposta em formato inesperado')
      }
    })
  })
}

const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`

/** Comando para abrir o Claude Code nessa conta (para o usuário copiar). */
export function launchCommand(configDir: string): string {
  if (configDir === DEFAULT_CONFIG_DIR) return 'claude'
  const rel = configDir.startsWith(HOME + '/') ? `"$HOME/${configDir.slice(HOME.length + 1)}"` : q(configDir)
  return `CLAUDE_CONFIG_DIR=${rel} claude`
}

/**
 * Abre o Terminal com o Claude Code na pasta da conta. Sem login, o próprio Claude Code
 * pede o login no navegador (fluxo oficial). Só macOS por enquanto; nos outros, devolve o comando.
 */
export function openLoginTerminal(claude: string, configDir: string, label: string): { opened: string | null; command: string } {
  const command = launchCommand(configDir)
  if (process.platform !== 'darwin') return { opened: null, command }
  mkdirSync(ORBIT_DIR, { recursive: true, mode: 0o700 })
  const file = join(ORBIT_DIR, `login-${label.replace(/[^\w-]/g, '_')}.command`)
  const env = configDir === DEFAULT_CONFIG_DIR ? 'unset CLAUDE_CONFIG_DIR' : `export CLAUDE_CONFIG_DIR=${q(configDir)}`
  writeFileSync(
    file,
    `#!/bin/sh
clear
echo "Orbit · conta ${label.replace(/["$`\\]/g, '')}"
echo "Se o Claude Code pedir, faça o login no navegador. Depois pode fechar esta janela."
echo
cd "$HOME"
${env}
exec ${q(claude)}
`
  )
  chmodSync(file, 0o755)
  return { opened: file, command }
}

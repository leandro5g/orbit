import { readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { Account, Session } from '../shared/types.ts'
import { ownPids } from './claude-cli.ts'
import { changesFor, repoRootOf } from './git.ts'
import { EVENTS_DIR } from './paths.ts'
import { deriveState, type HookEvent } from './state.ts'
import type { StatuslineScan } from './usage.ts'

/** Arquivo que o Claude Code mantém em <config>/sessions/<pid>.json enquanto a sessão está aberta. */
interface SessionFile {
  pid: number
  sessionId: string
  cwd: string
  startedAt: number
  name?: string
  status?: string
  updatedAt?: number
  statusUpdatedAt?: number
}

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T
  } catch {
    return null
  }
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM'
  }
}

function turnStart(sessionId: string): number | null {
  try {
    const s = Number(readFileSync(join(EVENTS_DIR, `.${sessionId}.turn`), 'utf8'))
    return Number.isFinite(s) && s > 0 ? s * 1000 : null
  } catch {
    return null
  }
}

export async function readSessions(account: Account, scan: StatuslineScan, now: number): Promise<Session[]> {
  let files: string[]
  try {
    files = readdirSync(join(account.configDir, 'sessions')).filter((n) => /^\d+\.json$/.test(n))
  } catch {
    return []
  }

  const out: Session[] = []
  for (const name of files) {
    const f = readJson<SessionFile>(join(account.configDir, 'sessions', name))
    if (!f?.sessionId || !f.pid || ownPids.has(f.pid) || !alive(f.pid)) continue // finalizada, ou é o /usage do Orbit

    const sl = scan.bySession.get(f.sessionId)
    const hook = readJson<HookEvent>(join(EVENTS_DIR, `${f.sessionId}.json`))
    const statusSince = f.statusUpdatedAt ?? f.updatedAt ?? f.startedAt
    const d = deriveState(f.status, statusSince, hook, turnStart(f.sessionId), now)

    const root = await repoRootOf(f.cwd, now)
    const changes = root ? await changesFor(root, now) : null

    out.push({
      id: f.sessionId,
      pid: f.pid,
      accountId: account.id,
      project: basename(root ?? f.cwd),
      cwd: f.cwd,
      title: sl?.session_name || f.name || basename(f.cwd),
      model: sl?.model?.display_name ?? null,
      state: d.state,
      tool: d.tool,
      startedAt: f.startedAt,
      stateSince: d.since,
      updatedAt: Math.max(f.updatedAt ?? 0, hook ? hook.ts * 1000 : 0, statusSince),
      claudeLinesAdded: sl?.cost?.total_lines_added ?? null,
      claudeLinesRemoved: sl?.cost?.total_lines_removed ?? null,
      changes
    })
  }
  return out
}

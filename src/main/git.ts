import { execFile } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { CodeChanges } from '../shared/types.ts'

function git(cwd: string, args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    // --no-optional-locks: não disputa o index.lock com o git que o Claude Code estiver rodando.
    execFile(
      'git',
      ['--no-optional-locks', '-C', cwd, ...args],
      { timeout: 4000, maxBuffer: 16 * 1024 * 1024 },
      (err, stdout) => resolve(err ? null : stdout)
    )
  })
}

const ROOT_TTL = 60_000
const STATS_TTL = 8_000
const rootCache = new Map<string, { root: string | null; at: number }>()
const statsCache = new Map<string, { value: CodeChanges | null; at: number; pending?: Promise<CodeChanges | null> }>()

export async function repoRootOf(cwd: string, now = Date.now()): Promise<string | null> {
  const hit = rootCache.get(cwd)
  if (hit && now - hit.at < ROOT_TTL) return hit.root
  const out = await git(cwd, ['rev-parse', '--show-toplevel'])
  const root = out ? out.trim() : null
  rootCache.set(cwd, { root, at: now })
  return root
}

function countLines(file: string): number {
  try {
    const st = statSync(file)
    if (!st.isFile() || st.size > 1024 * 1024) return 0
    const buf = readFileSync(file)
    if (buf.includes(0)) return 0 // binário
    let n = 0
    for (const b of buf) if (b === 10) n++
    return buf.length > 0 && buf[buf.length - 1] !== 10 ? n + 1 : n
  } catch {
    return 0
  }
}

async function compute(root: string): Promise<CodeChanges | null> {
  const [branchOut, statusOut, numstatOut] = await Promise.all([
    git(root, ['symbolic-ref', '--short', '-q', 'HEAD']),
    git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all']),
    git(root, ['diff', 'HEAD', '--numstat'])
  ])
  if (statusOut === null) return null

  const changes: CodeChanges = {
    repoRoot: root,
    branch: branchOut?.trim() || null,
    filesModified: 0,
    filesAdded: 0,
    filesDeleted: 0,
    linesAdded: 0,
    linesRemoved: 0,
    lastFile: null
  }

  const paths: string[] = []
  const untracked: string[] = []
  const parts = statusOut.split('\0')
  for (let i = 0; i < parts.length; i++) {
    const entry = parts[i]
    if (entry.length < 4) continue
    const x = entry[0]
    const y = entry[1]
    const path = entry.slice(3)
    if (x === 'R' || x === 'C') i++ // o caminho de origem vem no item seguinte
    if (x === '?' && y === '?') {
      changes.filesAdded++
      untracked.push(path)
    } else if (x === 'A') changes.filesAdded++
    else if (x === 'D' || y === 'D') changes.filesDeleted++
    else changes.filesModified++
    if (x !== 'D' && y !== 'D') paths.push(path)
  }

  for (const line of (numstatOut ?? '').split('\n')) {
    const [a, r] = line.split('\t')
    if (a === undefined || r === undefined) continue
    changes.linesAdded += Number(a) || 0
    changes.linesRemoved += Number(r) || 0
  }
  for (const p of untracked.slice(0, 300)) changes.linesAdded += countLines(join(root, p))

  let newest = 0
  for (const p of paths.slice(0, 400)) {
    try {
      const m = statSync(join(root, p)).mtimeMs
      if (m > newest) {
        newest = m
        changes.lastFile = p
      }
    } catch {
      /* removido no meio */
    }
  }
  return changes
}

/** Alterações não commitadas do repositório. Cache por repo: várias sessões no mesmo repo não duplicam a contagem. */
export function changesFor(root: string, now = Date.now()): Promise<CodeChanges | null> {
  const hit = statsCache.get(root)
  if (hit?.pending) return hit.pending
  if (hit && now - hit.at < STATS_TTL) return Promise.resolve(hit.value)
  const pending = compute(root).then((value) => {
    statsCache.set(root, { value, at: Date.now() })
    return value
  })
  statsCache.set(root, { value: hit?.value ?? null, at: hit?.at ?? 0, pending })
  return pending
}

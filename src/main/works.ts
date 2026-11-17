import { closeSync, copyFileSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import type { AccountView, Session, Settings, Work, WorkStatus } from '../shared/types.ts'
import { parseNote, pressure } from '../shared/works.ts'
import type { LocalStore } from './db.ts'
import { changedFiles } from './git.ts'
import { HANDOFF_DIR } from './paths.ts'

/**
 * Trabalhos: a tarefa por trás de cada sessão do Claude Code.
 *
 * - Cada sessão nova vira um trabalho (o nome vem do título que o Claude Code dá à conversa).
 * - Quando a conta passa de `handoffAt`%, o Orbit escreve um rascunho do registro de continuação
 *   (sem tokens, a partir do histórico local) e pede ao Claude, pelo hook de fim de turno, o registro completo.
 * - Ao continuar em outra conta, abre o Claude Code na mesma pasta, na conta escolhida, lendo o registro.
 *   A sessão nova é ligada ao mesmo trabalho.
 */

interface WorkRow {
  id: string
  title: string | null
  custom_title: string | null
  project: string
  cwd: string
  root: string
  account: string
  session_id: string
  status: WorkStatus
  created: number
  updated: number
  requested_at: number | null
  hidden: number
  done_at: number | null
}

/** Continuação aberta pelo Orbit e ainda não vista como sessão. */
interface PendingLink {
  workId: string
  accountId: string
  cwd: string
  at: number
}

const PENDING_KEY = 'works:pending'
const LINK_WINDOW_MS = 15 * 60_000
const PAUSED_VISIBLE_MS = 12 * 3600_000
const DONE_VISIBLE_MS = 3 * 24 * 3600_000

// ---------- histórico do Claude Code (<config>/projects/<pasta>/<session>.jsonl) ----------

/** Nome da pasta do projeto no histórico do Claude Code: o caminho com tudo que não é letra ou número trocado por "-". */
export function projectSlug(cwd: string): string {
  return cwd.replace(/[^a-zA-Z0-9]/g, '-')
}

export function findTranscript(configDir: string, cwd: string, sessionId: string): string | null {
  const direct = join(configDir, 'projects', projectSlug(cwd), `${sessionId}.jsonl`)
  if (existsSync(direct)) return direct
  try {
    for (const d of readdirSync(join(configDir, 'projects'))) {
      const f = join(configDir, 'projects', d, `${sessionId}.jsonl`)
      if (existsSync(f)) return f
    }
  } catch {
    /* conta sem histórico */
  }
  return null
}

function readSlice(file: string, fromEnd: boolean, bytes: number): string[] {
  let fd: number | null = null
  try {
    const size = statSync(file).size
    const len = Math.min(size, bytes)
    const buf = Buffer.alloc(len)
    fd = openSync(file, 'r')
    readSync(fd, buf, 0, len, fromEnd ? size - len : 0)
    const lines = buf.toString('utf8').split('\n')
    // Linhas cortadas pela fatia: a primeira (lendo do fim) ou a última (lendo do início).
    if (fromEnd && len < size) lines.shift()
    if (!fromEnd && len < size) lines.pop()
    return lines.filter(Boolean)
  } catch {
    return []
  } finally {
    if (fd !== null) closeSync(fd)
  }
}

interface Entry {
  type?: string
  aiTitle?: string
  isMeta?: boolean
  message?: { role?: string; content?: unknown }
}

function parse(line: string): Entry | null {
  try {
    return JSON.parse(line) as Entry
  } catch {
    return null
  }
}

/** Texto digitado pelo usuário (descarta resultados de ferramenta, comandos e lembretes do sistema). */
function userText(e: Entry): string | null {
  if (e.type !== 'user' || e.isMeta) return null
  const c = e.message?.content
  const text =
    typeof c === 'string'
      ? c
      : Array.isArray(c)
        ? c
            .filter((p: { type?: string }) => p?.type === 'text')
            .map((p: { text?: string }) => p.text ?? '')
            .join('\n')
        : ''
  const t = text.trim()
  if (!t || t.startsWith('<') || t.startsWith('[Request interrupted')) return null
  return t
}

function assistantText(e: Entry): string | null {
  if (e.type !== 'assistant' || !Array.isArray(e.message?.content)) return null
  const t = (e.message!.content as { type?: string; text?: string }[])
    .filter((p) => p?.type === 'text')
    .map((p) => p.text ?? '')
    .join('\n')
    .trim()
  return t || null
}

export interface TranscriptInfo {
  aiTitle: string | null
  firstPrompt: string | null
  recentPrompts: string[]
  lastReply: string | null
}

export function transcriptInfo(file: string): TranscriptInfo {
  const head = readSlice(file, false, 512 * 1024).map(parse).filter((e): e is Entry => !!e)
  const tail = readSlice(file, true, 1024 * 1024).map(parse).filter((e): e is Entry => !!e)
  const aiTitle = [...tail].reverse().find((e) => e.type === 'ai-title' && e.aiTitle)?.aiTitle ?? head.find((e) => e.type === 'ai-title')?.aiTitle ?? null
  const firstPrompt = head.map(userText).find(Boolean) ?? null
  const prompts = tail.map(userText).filter((t): t is string => !!t)
  const lastReply = [...tail].reverse().map(assistantText).find(Boolean) ?? null
  return { aiTitle, firstPrompt, recentPrompts: prompts.slice(-5), lastReply }
}

const titleCache = new Map<string, { title: string | null; at: number }>()

function aiTitleFor(configDir: string, cwd: string, sessionId: string, now: number): string | null {
  const hit = titleCache.get(sessionId)
  if (hit && now - hit.at < 60_000) return hit.title
  const file = findTranscript(configDir, cwd, sessionId)
  let title: string | null = null
  if (file) {
    const tail = readSlice(file, true, 256 * 1024)
    for (let i = tail.length - 1; i >= 0 && !title; i--) {
      if (!tail[i].includes('"ai-title"')) continue
      title = parse(tail[i])?.aiTitle ?? null
    }
  }
  titleCache.set(sessionId, { title: title ?? hit?.title ?? null, at: now })
  return title ?? hit?.title ?? null
}

// ---------- registro de continuação ----------

export function noteFileFor(root: string, workId: string): string {
  return join(root, '.orbit', 'trabalhos', `${workId}.md`)
}

/** Cria <repo>/.orbit com um .gitignore que ignora tudo: o registro nunca vai para o git. */
function ensureNoteDir(file: string): void {
  const orbitDir = dirname(dirname(file))
  mkdirSync(dirname(file), { recursive: true })
  const gi = join(orbitDir, '.gitignore')
  if (!existsSync(gi)) writeFileSync(gi, '# Criado pelo Orbit: registros de continuação locais, fora do git.\n*\n')
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n).trimEnd() + '…' : s)
const quote = (s: string) => s.split('\n').map((l) => `> ${l}`).join('\n')

/** Rascunho do registro feito pelo Orbit, sem tokens: histórico local + git. O Claude reescreve por cima. */
export function orbitNote(o: {
  title: string
  project: string
  branch: string | null
  account: string
  info: TranscriptInfo | null
  files: string[]
  now: number
}): string {
  const when = new Date(o.now).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  const i = o.info
  const parts = [
    `# ${o.title}`,
    '<!-- orbit:by=orbit -->',
    `_Rascunho montado pelo Orbit a partir do histórico da sessão (o Claude ainda não escreveu o resumo). Projeto ${o.project}${o.branch ? `, branch ${o.branch}` : ''}, conta ${o.account}, ${when}._`,
    '',
    '## Objetivo',
    i?.firstPrompt ? quote(clip(i.firstPrompt, 1500)) : '(não encontrado no histórico)',
    ''
  ]
  const recent = (i?.recentPrompts ?? []).filter((p) => p !== i?.firstPrompt)
  if (recent.length) parts.push('## Pedidos recentes', ...recent.map((p) => `- ${clip(p.replace(/\s+/g, ' '), 400)}`), '')
  if (i?.lastReply) parts.push('## Última resposta do Claude', quote(clip(i.lastReply, 2500)), '')
  parts.push('## Arquivos com alterações (git)', ...(o.files.length ? o.files.map((f) => `- \`${f.trim()}\``) : ['(nenhuma alteração não commitada)']), '')
  parts.push(
    '## Próximo passo',
    'Conferir o estado do repositório (git status / git diff), entender onde a tarefa parou e continuar.',
    ''
  )
  return parts.join('\n')
}

/** Pedido ao Claude, entregue pelo hook no fim do turno. */
export function handoffPrompt(noteFile: string, pct: number | null): string {
  return [
    `[Orbit] ${pct != null ? `A conta está em ${pct}% do limite. ` : ''}Antes de seguir, salve o registro de continuação desta tarefa, para que ela possa ser retomada em outra conta do Claude Code sem perder contexto.`,
    `Reescreva por inteiro o arquivo ${noteFile}, em português, curto e objetivo, com exatamente estas seções:`,
    '# <título curto da tarefa>',
    '## Objetivo',
    '## Feito  (itens "- [x] ...")',
    '## Falta  (itens "- [ ] ...", em ordem)',
    '## Decisões e contexto  (o que alguém sem este histórico precisa saber: escolhas, armadilhas, comandos, links)',
    '## Arquivos  (os principais arquivos mexidos e por quê)',
    '## Próximo passo  (uma linha)',
    'Não faça mais nada além disso. Depois, termine com uma linha: "Registro de continuação salvo."'
  ].join('\n')
}

/** Prompt inicial da sessão que continua o trabalho em outra conta. */
export function continuePrompt(noteFile: string): string {
  return `Continue o trabalho descrito em ${noteFile} (registro de continuação de uma sessão em outra conta). Leia o arquivo, confira o estado do repositório com git status, resuma em duas linhas onde paramos e siga pelo próximo passo. Conforme avançar, mantenha esse arquivo atualizado (marque o que foi feito).`
}

// ---------- rastreio ----------

export class WorkTracker {
  private noteCache = new Map<string, { mtime: number; summary: ReturnType<typeof parseNote> }>()
  private store: LocalStore
  private onSwitchAlert: (from: AccountView, works: number) => void

  constructor(store: LocalStore, onSwitchAlert: (from: AccountView, works: number) => void) {
    this.store = store
    this.onSwitchAlert = onSwitchAlert
  }

  private row(id: string): WorkRow | undefined {
    return this.store.one<WorkRow>('SELECT * FROM works WHERE id = ?', id)
  }

  private pending(): PendingLink[] {
    return this.store.get<PendingLink[]>(PENDING_KEY, [])
  }

  /** Liga a sessão a um trabalho: o já ligado, uma continuação aberta pelo Orbit, ou um trabalho novo. */
  private workFor(s: Session, acc: AccountView, now: number): string {
    const mapped = this.store.one<{ work_id: string }>('SELECT work_id FROM work_sessions WHERE session_id = ?', s.id)
    if (mapped && this.row(mapped.work_id)) return mapped.work_id

    let workId = s.id
    const links = this.pending().filter((p) => now - p.at < LINK_WINDOW_MS)
    const link = links.find((p) => p.accountId === acc.id && p.cwd === s.cwd && s.startedAt >= p.at - 10_000)
    if (link && this.row(link.workId)) {
      workId = link.workId
      links.splice(links.indexOf(link), 1)
    }
    this.store.set(PENDING_KEY, links)

    if (!this.row(workId)) {
      const root = s.changes?.repoRoot ?? s.cwd
      this.store.run(
        `INSERT INTO works (id, title, project, cwd, root, account, session_id, status, created, updated)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
        workId, s.title, s.project, s.cwd, root, acc.id, s.id, now, now
      )
    }
    this.store.run('INSERT OR REPLACE INTO work_sessions (session_id, work_id, account, started) VALUES (?, ?, ?, ?)', s.id, workId, acc.id, s.startedAt)
    return workId
  }

  sync(accounts: AccountView[], settings: Settings, now: number): Work[] {
    const alive = new Map<string, { s: Session; acc: AccountView }>()
    const sessions = accounts.flatMap((acc) => acc.sessions.map((s) => ({ s, acc }))).sort((a, b) => a.s.startedAt - b.s.startedAt)
    for (const { s, acc } of sessions) {
      const workId = this.workFor(s, acc, now)
      alive.set(s.id, { s, acc })
      const title = aiTitleFor(acc.configDir, s.cwd, s.id, now) ?? s.title
      // A sessão mais recente do trabalho manda: é nela que o trabalho está agora.
      this.store.run(
        `UPDATE works SET account = ?, session_id = ?, cwd = ?, title = ?, updated = ?,
           status = CASE WHEN status = 'done' THEN 'done' ELSE 'active' END
         WHERE id = ?`,
        acc.id, s.id, s.cwd, title, now, workId
      )
    }
    for (const w of this.store.all<WorkRow>("SELECT * FROM works WHERE status = 'active'"))
      if (!alive.has(w.session_id)) this.store.run("UPDATE works SET status = 'paused' WHERE id = ?", w.id)

    const rows = this.store.all<WorkRow>('SELECT * FROM works WHERE hidden = 0 ORDER BY updated DESC')

    for (const acc of accounts) {
      const pct = pressure(acc)
      if (pct == null) continue
      const windowKey = acc.usage.fiveHour?.resetsAt ?? acc.usage.sevenDay?.resetsAt ?? 0
      const mine = rows.filter((w) => w.account === acc.id && w.status === 'active' && alive.has(w.session_id))
      if (settings.handoffEnabled && pct >= settings.handoffAt) {
        for (const w of mine) {
          const key = `handoff:${w.id}:${w.session_id}:${windowKey}`
          if (this.store.get(key, false)) continue
          this.store.set(key, true)
          void this.requestNote(w.id, acc, pct, now)
        }
      }
      if (mine.length && pct >= settings.switchAlertAt) {
        const key = `alert:${acc.id}:switch:${windowKey}`
        if (!this.store.get(key, false)) {
          this.store.set(key, true)
          this.onSwitchAlert(acc, mine.length)
        }
      }
    }

    return rows
      .filter((w) =>
        w.status === 'active' ? true : w.status === 'done' ? now - (w.done_at ?? w.updated) < DONE_VISIBLE_MS : now - w.updated < PAUSED_VISIBLE_MS || existsSync(noteFileFor(w.root, w.id))
      )
      .map((w) => this.toWork(w))
  }

  private summary(file: string) {
    try {
      const mtime = statSync(file).mtimeMs
      const hit = this.noteCache.get(file)
      if (hit && hit.mtime === mtime) return { ...hit.summary, mtime }
      const summary = parseNote(readFileSync(file, 'utf8'))
      this.noteCache.set(file, { mtime, summary })
      return { ...summary, mtime }
    } catch {
      return null
    }
  }

  private toWork(w: WorkRow): Work {
    const noteFile = noteFileFor(w.root, w.id)
    const n = this.summary(noteFile)
    const answered = n && w.requested_at && n.by === 'claude' && n.mtime >= w.requested_at
    return {
      id: w.id,
      title: w.custom_title || n?.title || w.title || w.project,
      project: w.project,
      cwd: w.cwd,
      accountId: w.account,
      sessionId: w.session_id,
      status: w.status,
      noteFile,
      noteBy: n?.by ?? null,
      noteAt: n ? Math.round(n.mtime) : null,
      doneItems: n?.doneItems ?? null,
      totalItems: n?.totalItems ?? null,
      // O "próximo passo" do rascunho do Orbit é genérico: só vale o do Claude.
      next: n?.by === 'claude' ? n.next : null,
      requestedAt: answered ? null : w.requested_at,
      updatedAt: w.updated
    }
  }

  /** Escreve o rascunho do Orbit (se o Claude ainda não escreveu) e pede ao Claude o registro completo. */
  async requestNote(workId: string, acc: AccountView | undefined, pct: number | null, now: number): Promise<{ asked: boolean; file: string } | null> {
    const w = this.row(workId)
    if (!w) return null
    const file = noteFileFor(w.root, w.id)
    try {
      ensureNoteDir(file)
      if (!existsSync(file) || parseNote(readFileSync(file, 'utf8')).by === 'orbit') await this.writeOrbitNote(w, acc, now)
    } catch (e) {
      console.error('[orbit] não consegui escrever o registro', file, e)
      return null
    }
    const live = acc?.sessions.some((s) => s.id === w.session_id)
    // Conta já esgotada: o Claude não teria como responder; fica o rascunho do Orbit.
    if (!acc?.integration.hooks || !live || (pct ?? 0) >= 100) return { asked: false, file }
    mkdirSync(HANDOFF_DIR, { recursive: true, mode: 0o700 })
    writeFileSync(join(HANDOFF_DIR, w.session_id), JSON.stringify(handoffPrompt(file, pct)))
    this.store.run('UPDATE works SET requested_at = ? WHERE id = ?', now, w.id)
    return { asked: true, file }
  }

  private async writeOrbitNote(w: WorkRow, acc: AccountView | undefined, now: number): Promise<void> {
    const transcript = acc ? findTranscript(acc.configDir, w.cwd, w.session_id) : null
    const files = await changedFiles(w.root)
    const branch = acc?.sessions.find((s) => s.id === w.session_id)?.changes?.branch ?? null
    const file = noteFileFor(w.root, w.id)
    writeFileSync(
      file,
      orbitNote({
        title: w.custom_title || w.title || w.project,
        project: w.project,
        branch,
        account: acc?.name ?? w.account,
        info: transcript ? transcriptInfo(transcript) : null,
        files: files.filter((f) => !f.includes('.orbit/')),
        now
      })
    )
    this.noteCache.delete(file)
  }

  /**
   * Prepara a continuação em outra conta: garante o registro, cancela o pedido pendente na sessão antiga,
   * opcionalmente leva a conversa inteira e devolve como abrir o Claude Code na conta nova.
   */
  async prepareContinue(
    workId: string,
    from: AccountView | undefined,
    to: AccountView,
    fullHistory: boolean,
    now: number
  ): Promise<{ cwd: string; args: string[]; title: string } | { error: string }> {
    const w = this.row(workId)
    if (!w) return { error: 'Trabalho não encontrado.' }
    const file = noteFileFor(w.root, w.id)
    try {
      ensureNoteDir(file)
      if (!existsSync(file)) await this.writeOrbitNote(w, from, now)
    } catch {
      return { error: `Não consegui escrever o registro em ${file}.` }
    }
    rmSync(join(HANDOFF_DIR, w.session_id), { force: true })

    let args = [continuePrompt(file)]
    if (fullHistory && from) {
      const src = findTranscript(from.configDir, w.cwd, w.session_id)
      if (src) {
        const dest = join(to.configDir, 'projects', basename(dirname(src)))
        mkdirSync(dest, { recursive: true })
        copyFileSync(src, join(dest, basename(src)))
        args = ['--resume', w.session_id, `Esta conversa veio de outra conta. O registro de continuação está em ${file}. Siga de onde paramos.`]
      }
    }
    const links = this.pending().filter((p) => now - p.at < LINK_WINDOW_MS && p.workId !== w.id)
    links.push({ workId: w.id, accountId: to.id, cwd: w.cwd, at: now })
    this.store.set(PENDING_KEY, links)
    this.store.run("UPDATE works SET status = 'paused', updated = ? WHERE id = ? AND status != 'done'", now, w.id)
    return { cwd: w.cwd, args, title: w.custom_title || w.title || w.project }
  }

  noteText(workId: string): string | null {
    const w = this.row(workId)
    if (!w) return null
    try {
      return readFileSync(noteFileFor(w.root, w.id), 'utf8')
    } catch {
      return null
    }
  }

  rename(workId: string, title: string): void {
    this.store.run('UPDATE works SET custom_title = ? WHERE id = ?', title.trim().slice(0, 80) || null, workId)
  }

  finish(workId: string, now: number): void {
    this.store.run("UPDATE works SET status = 'done', done_at = ?, updated = ? WHERE id = ?", now, now, workId)
  }

  dismiss(workId: string): void {
    this.store.run('UPDATE works SET hidden = 1 WHERE id = ?', workId)
  }

  accountOf(workId: string): string | null {
    return this.row(workId)?.account ?? null
  }
}

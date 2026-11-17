import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AccountView, Session, Settings } from '../shared/types.ts'
import { parseNote, recommendAccount } from '../shared/works.ts'

// HOME falso antes de importar: paths.ts resolve ~/.orbit na importação.
const home = mkdtempSync(join(tmpdir(), 'orbit-works-'))
process.env.HOME = home
const { projectSlug, transcriptInfo, orbitNote, WorkTracker, noteFileFor } = await import('./works.ts')
const { LocalStore } = await import('./db.ts')

const now = 1_800_000_000_000
const usage = (five: number | null, week: number | null = 10) => ({
  fiveHour: five == null ? null : { usedPercent: five, resetsAt: now + 3600_000, renewed: false },
  sevenDay: week == null ? null : { usedPercent: week, resetsAt: now + 86400_000, renewed: false },
  observedAt: now,
  source: 'usage' as const,
  forecast: null
})
const account = (id: string, five: number | null, extra: Partial<AccountView> = {}): AccountView => ({
  id,
  configDir: join(home, `.${id}`),
  name: id,
  email: `${id}@example.com`,
  organization: null,
  needsLogin: false,
  launchCommand: 'claude',
  integration: { statusline: true, hooks: true, statuslineConflict: null },
  usage: usage(five),
  sessions: [],
  state: 'idle',
  alert: false,
  ...extra
})

test('registro: lê título, checklist e próximo passo', () => {
  const md = '# Migrar posts\n\n## Feito\n- [x] a\n- [X] b\n\n## Falta\n- [ ] c\n\n## Próximo passo\nRodar os testes\n'
  assert.deepEqual(parseNote(md), { title: 'Migrar posts', doneItems: 2, totalItems: 3, next: 'Rodar os testes', by: 'claude' })
  const draft = orbitNote({ title: 'X', project: 'p', branch: 'main', account: 'Pessoal', info: null, files: [' M a.ts'], now })
  const n = parseNote(draft)
  assert.equal(n.by, 'orbit')
  assert.equal(n.title, 'X')
  assert.equal(n.totalItems, null)
  assert.match(draft, /`M a.ts`/)
})

test('conta recomendada: menor uso, ignora esgotada, sem login e a própria', () => {
  const a = account('a', 95)
  const b = account('b', 40, { usage: usage(40, 80) })
  const c = account('c', 20)
  const d = account('d', 100)
  const e = account('e', 1, { needsLogin: true })
  assert.equal(recommendAccount([a, b, c, d, e], 'a')?.id, 'c')
  assert.equal(recommendAccount([a, d], 'a'), null)
})

test('histórico: pasta do projeto e resumo da conversa', () => {
  assert.equal(projectSlug('/Users/x.y/meus-projetos/orbit-mvp'), '-Users-x-y-meus-projetos-orbit-mvp')
  const f = join(home, 't.jsonl')
  const lines = [
    { type: 'user', message: { role: 'user', content: 'Crie a tela de trabalhos' } },
    { type: 'user', isMeta: true, message: { content: 'meta' } },
    { type: 'user', message: { content: [{ type: 'tool_result', content: 'x' }] } },
    { type: 'assistant', message: { content: [{ type: 'text', text: 'Feito o modelo.' }, { type: 'tool_use', name: 'Edit' }] } },
    { type: 'ai-title', aiTitle: 'Tela de trabalhos' },
    { type: 'user', message: { content: '<command-name>/compact</command-name>' } },
    { type: 'user', message: { content: [{ type: 'text', text: 'agora os testes' }] } }
  ]
  writeFileSync(f, lines.map((l) => JSON.stringify(l)).join('\n') + '\n')
  assert.deepEqual(transcriptInfo(f), {
    aiTitle: 'Tela de trabalhos',
    firstPrompt: 'Crie a tela de trabalhos',
    recentPrompts: ['Crie a tela de trabalhos', 'agora os testes'],
    lastReply: 'Feito o modelo.'
  })
})

const settings = { handoffEnabled: true, handoffAt: 90, switchAlertAt: 95 } as Settings
const session = (id: string, accountId: string, cwd: string, startedAt: number): Session => ({
  id,
  pid: 1,
  accountId,
  project: 'proj',
  cwd,
  title: 'proj',
  model: null,
  state: 'working',
  tool: null,
  startedAt,
  stateSince: startedAt,
  updatedAt: startedAt,
  claudeLinesAdded: null,
  claudeLinesRemoved: null,
  changes: null
})

test('trabalho: registra nos 90%, avisa nos 95% e continua em outra conta como o mesmo trabalho', async () => {
  const store = new LocalStore(':memory:')
  const alerts: string[] = []
  const tracker = new WorkTracker(store, (a) => alerts.push(a.id))
  const cwd = join(home, 'repo')
  mkdirSync(cwd)

  const pessoal = account('pessoal', 50)
  const trabalho = account('trabalho', 10)
  pessoal.sessions = [session('s1', 'pessoal', cwd, now - 60_000)]
  let works = tracker.sync([pessoal, trabalho], settings, now)
  assert.equal(works.length, 1)
  assert.equal(works[0].status, 'active')
  assert.equal(works[0].noteBy, null)

  // 92%: rascunho do Orbit + pedido ao Claude pelo hook.
  pessoal.usage = usage(92)
  tracker.sync([pessoal, trabalho], settings, now)
  await new Promise((r) => setTimeout(r, 200))
  const note = noteFileFor(cwd, 's1')
  assert.ok(existsSync(note))
  assert.equal(readFileSync(join(cwd, '.orbit', '.gitignore'), 'utf8').trim().split('\n').pop(), '*')
  const req = JSON.parse(readFileSync(join(home, '.orbit', 'handoff', 's1'), 'utf8'))
  assert.match(req, new RegExp(note.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  works = tracker.sync([pessoal, trabalho], settings, now)
  assert.equal(works[0].noteBy, 'orbit')
  assert.ok(works[0].requestedAt)
  assert.deepEqual(alerts, [])

  // 96%: avisa uma vez só.
  pessoal.usage = usage(96)
  tracker.sync([pessoal, trabalho], settings, now)
  tracker.sync([pessoal, trabalho], settings, now)
  assert.deepEqual(alerts, ['pessoal'])

  // Continua na outra conta: pedido antigo cancelado, sessão nova ligada ao mesmo trabalho.
  const r = await tracker.prepareContinue('s1', pessoal, trabalho, false, now + 1000)
  assert.ok(!('error' in r))
  assert.ok(!existsSync(join(home, '.orbit', 'handoff', 's1')))
  pessoal.sessions = []
  trabalho.sessions = [session('s2', 'trabalho', cwd, now + 5000)]
  works = tracker.sync([pessoal, trabalho], settings, now + 6000)
  assert.equal(works.length, 1)
  assert.equal(works[0].id, 's1')
  assert.equal(works[0].accountId, 'trabalho')
  assert.equal(works[0].sessionId, 's2')
  assert.equal(works[0].status, 'active')
  store.close()
})

test('conta já esgotada: só o rascunho do Orbit, sem pedir ao Claude', async () => {
  const store = new LocalStore(':memory:')
  const tracker = new WorkTracker(store, () => {})
  const cwd = join(home, 'repo-cheio')
  mkdirSync(cwd)
  const cheia = account('cheia', 100)
  cheia.sessions = [session('z1', 'cheia', cwd, now - 60_000)]
  tracker.sync([cheia], settings, now)
  await new Promise((r) => setTimeout(r, 200))
  assert.ok(existsSync(noteFileFor(cwd, 'z1')))
  assert.ok(!existsSync(join(home, '.orbit', 'handoff', 'z1')))
  const [w] = tracker.sync([cheia], settings, now)
  assert.equal(w.noteBy, 'orbit')
  assert.equal(w.next, null)
  assert.equal(w.requestedAt, null)
  store.close()
})

test('conta esgotada pede troca mesmo com a sessão já parada; abaixo de 100% só com sessão rodando', async () => {
  const { accountsNeedingSwitch, backAt } = await import('../shared/works.ts')
  const acc = (id: string, pct: number, resetsAt = 1000) =>
    ({ id, usage: { fiveHour: { usedPercent: pct, resetsAt, renewed: false }, sevenDay: null } }) as never
  const work = (accountId: string, status: 'active' | 'paused' | 'done') => ({ accountId, status }) as never
  const ids = (xs: { id: string }[]) => xs.map((x) => x.id)
  assert.deepEqual(ids(accountsNeedingSwitch([acc('lab', 100)], [work('lab', 'paused')], 95)), ['lab'])
  assert.deepEqual(ids(accountsNeedingSwitch([acc('lab', 100)], [work('lab', 'done')], 95)), [])
  assert.deepEqual(ids(accountsNeedingSwitch([acc('p', 96)], [work('p', 'paused')], 95)), [])
  assert.deepEqual(ids(accountsNeedingSwitch([acc('p', 96)], [work('p', 'active')], 95)), ['p'])
  assert.equal(backAt(acc('lab', 100, 5000)), 5000)
  assert.equal(backAt(acc('p', 96)), null)
})

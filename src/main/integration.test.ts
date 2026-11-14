import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// HOME falso antes de importar: paths.ts resolve ~/.orbit na importação.
const home = mkdtempSync(join(tmpdir(), 'orbit-home-'))
process.env.HOME = home
const { installIntegration, detectIntegration, HOOK_EVENTS } = await import('./integration.ts')
const cfg = join(home, '.claude')
mkdirSync(cfg)

const run = (script: string, input: string, env: Record<string, string> = {}) =>
  execFileSync('sh', [join(home, '.orbit', script)], { input, env: { PATH: process.env.PATH!, HOME: home, ...env } }).toString()

test('instala sem substituir statusline de terceiros, preserva hooks e faz backup', () => {
  writeFileSync(join(cfg, 'settings.json'), JSON.stringify({ statusLine: { type: 'command', command: 'other.sh' }, hooks: { Stop: [{ hooks: [{ type: 'command', command: 'x' }] }] }, model: 'opus' }))
  const r = installIntegration(cfg)
  assert.equal(r.ok, false)
  assert.match(r.message, /statusline atual/)
  const s = JSON.parse(readFileSync(join(cfg, 'settings.json'), 'utf8'))
  assert.equal(s.statusLine.command, 'other.sh')
  assert.equal(s.model, 'opus')
  assert.equal(s.hooks.Stop.length, 2)
  for (const ev of HOOK_EVENTS) assert.ok(s.hooks[ev], ev)
  assert.ok(readdirSync(cfg).some((f) => f.includes('orbit-bak')))
  const d = detectIntegration(cfg)
  assert.equal(d.hooks, true)
  assert.equal(d.statusline, false)
  assert.equal(d.statuslineConflict, 'other.sh')
})

test('é idempotente e instala statusline quando não há outra', () => {
  writeFileSync(join(cfg, 'settings.json'), '{}')
  installIntegration(cfg)
  installIntegration(cfg)
  const s = JSON.parse(readFileSync(join(cfg, 'settings.json'), 'utf8'))
  assert.equal(s.hooks.Stop.length, 1)
  assert.ok(s.statusLine.command.endsWith('.orbit/statusline.sh'))
  assert.deepEqual(detectIntegration(cfg), { statusline: true, hooks: true, statuslineConflict: null })
})

test('hook.sh: sem saída, pega o primeiro session_id, nunca grava o prompt', () => {
  const out = run('hook.sh', JSON.stringify({ session_id: 'abc', hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'echo "session_id": "evil"' } }), { CLAUDE_CONFIG_DIR: join(home, '.claude-lab') })
  assert.equal(out, '')
  const ev = JSON.parse(readFileSync(join(home, '.orbit/events/abc.json'), 'utf8'))
  assert.equal(ev.event, 'PreToolUse')
  assert.equal(ev.tool, 'Bash')
  assert.equal(ev.account, 'claude-lab')
  run('hook.sh', JSON.stringify({ session_id: 'abc', hook_event_name: 'UserPromptSubmit', prompt: 'segredo' }))
  const files = readdirSync(join(home, '.orbit/events'))
  assert.ok(files.includes('.abc.turn'))
  for (const f of files) assert.ok(!readFileSync(join(home, '.orbit/events', f), 'utf8').includes('segredo'))
})

test('statusline.sh: grava uma cópia por sessão na pasta da conta', () => {
  const payload = JSON.stringify({ session_id: 's1', rate_limits: { five_hour: { used_percentage: 12, resets_at: 1 } } })
  assert.equal(run('statusline.sh', payload, { CLAUDE_CONFIG_DIR: join(home, '.claude-work') }), '')
  assert.equal(readFileSync(join(home, '.orbit/statusline/claude-work/s1.json'), 'utf8'), payload)
})

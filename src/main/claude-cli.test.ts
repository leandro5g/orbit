import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const home = mkdtempSync(join(tmpdir(), 'orbit-cli-'))
process.env.HOME = home
const { launchCommand, openLoginTerminal } = await import('./claude-cli.ts')

test('comando para abrir cada conta', () => {
  assert.equal(launchCommand(join(home, '.claude')), 'claude')
  assert.equal(launchCommand(join(home, '.claude-trabalho')), 'CLAUDE_CONFIG_DIR="$HOME/.claude-trabalho" claude')
  assert.equal(launchCommand("/opt/contas/d'avila"), `CLAUDE_CONFIG_DIR='/opt/contas/d'\\''avila' claude`)
})

test('script de login: sintaxe válida, conta certa e nome sem injeção', { skip: process.platform !== 'darwin' }, () => {
  const r = openLoginTerminal('/usr/local/bin/claude', join(home, '.claude-trabalho'), 'Trabalho "$(rm -rf ~)"')
  assert.ok(r.opened)
  execFileSync('sh', ['-n', r.opened!]) // só checa a sintaxe
  const body = readFileSync(r.opened!, 'utf8')
  assert.match(body, /export CLAUDE_CONFIG_DIR='.*\/\.claude-trabalho'/)
  assert.match(body, /exec '\/usr\/local\/bin\/claude'/)
  assert.ok(!body.includes('$(rm'))
  const def = readFileSync(openLoginTerminal('/usr/local/bin/claude', join(home, '.claude'), 'Principal').opened!, 'utf8')
  assert.match(def, /unset CLAUDE_CONFIG_DIR/)
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { forecast } from './forecast.ts'
import { deriveState } from './state.ts'
import { formatRemaining, formatElapsed, mostRelevant } from '../shared/format.ts'
import type { Session } from '../shared/types.ts'

const MIN = 60_000
const now = 1_800_000_000_000

test('previsão: ritmo de 20%/h a partir de 40% esgota em 3h', () => {
  const pts = [0, 15, 30, 45, 60].map((m) => ({ ts: now - (60 - m) * MIN, pct: 20 + (m / 60) * 20 }))
  const f = forecast(pts, now + 5 * 3600_000, now)!
  assert.equal(f.ratePerHour, 20)
  assert.equal(f.exhaustAt, now + 3 * 3600_000)
  assert.equal(f.beforeReset, true)
  assert.equal(f.confidence, 'média')
})

test('previsão: esgota depois do reset não é alerta', () => {
  const pts = [0, 30, 60].map((m) => ({ ts: now - (60 - m) * MIN, pct: 10 + m / 60 }))
  const f = forecast(pts, now + 3600_000, now)!
  assert.equal(f.beforeReset, false)
})

test('previsão: sem dados suficientes devolve null', () => {
  assert.equal(forecast([{ ts: now, pct: 30 }], now + 3600_000, now), null)
  assert.equal(forecast([{ ts: now - MIN, pct: 30 }, { ts: now, pct: 31 }], now + 3600_000, now), null)
})

test('previsão: consumo parado não prevê esgotamento', () => {
  const pts = [0, 20, 40].map((m) => ({ ts: now - (40 - m) * MIN, pct: 50 }))
  const f = forecast(pts, now + 3600_000, now)!
  assert.equal(f.exhaustAt, null)
  assert.equal(f.ratePerHour, 0)
})

const s = (sec: number) => Math.floor(sec / 1000)

test('estado: sem hooks, busy = trabalhando e idle = inativo', () => {
  assert.equal(deriveState('busy', now - MIN, null, null, now).state, 'working')
  assert.equal(deriveState('idle', now - MIN, null, null, now).state, 'idle')
})

test('estado: PermissionRequest mais novo que o status vira aprovação', () => {
  const hook = { event: 'PermissionRequest', tool: 'Bash', notification: '', ts: s(now - 5000) }
  const d = deriveState('busy', now - MIN, hook, null, now)
  assert.equal(d.state, 'approval')
  assert.equal(d.tool, 'Bash')
})

test('estado: idle logo após Stop vira concluído; depois de 10 min, inativo', () => {
  const hook = { event: 'Stop', tool: '', notification: '', ts: s(now - 2 * MIN) }
  assert.equal(deriveState('idle', now - 2 * MIN + 300, hook, null, now).state, 'completed')
  assert.equal(deriveState('idle', now - 2 * MIN + 300, hook, null, now + 15 * MIN).state, 'idle')
})

test('estado: StopFailure vira erro', () => {
  const hook = { event: 'StopFailure', tool: '', notification: '', ts: s(now - MIN) }
  assert.equal(deriveState('idle', now - MIN + 200, hook, null, now).state, 'error')
})

test('estado: ferramenta usa o início do turno como "executando há"', () => {
  const hook = { event: 'PreToolUse', tool: 'Edit', notification: '', ts: s(now - 10_000) }
  const d = deriveState('busy', now - 20 * MIN, hook, now - 42 * MIN, now)
  assert.deepEqual(d, { state: 'working', since: now - 42 * MIN, tool: 'Edit' })
})

test('formatação', () => {
  assert.equal(formatRemaining(2 * 3600_000 + 14 * MIN), '2h 14m')
  assert.equal(formatRemaining(3 * 24 * 3600_000), '3 dias')
  assert.equal(formatElapsed(42 * 1000), '00:42')
  assert.equal(formatElapsed(3723 * 1000), '1:02:03')
})

test('sessão mais relevante: aprovação vence trabalhando', () => {
  const base = { updatedAt: now } as Session
  const r = mostRelevant([
    { ...base, id: 'a', state: 'working' },
    { ...base, id: 'b', state: 'approval', updatedAt: now - MIN }
  ])
  assert.equal(r?.id, 'b')
})

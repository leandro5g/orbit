import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseReset, parseUsageText } from './usage-text.ts'

// 14/11/2026 12:00 em São Paulo (UTC-3) = 15:00 UTC
const now = Date.UTC(2026, 10, 14, 15, 0)

test('lê sessão e semana com reset e fuso', () => {
  const text = `You are currently using your subscription to power your Claude Code usage

Current session: 70% used · resets Nov 14 at 3:39pm (America/Sao_Paulo)
Current week (all models): 9% used · resets Nov 21 at 2:59am (America/Sao_Paulo)
Current week (Fable): 0% used · resets Nov 21 at 3am (America/Sao_Paulo)`
  const u = parseUsageText(text, now)
  assert.deepEqual(u.fiveHour, { usedPercent: 70, resetsAt: Date.UTC(2026, 10, 14, 18, 39) })
  assert.deepEqual(u.sevenDay, { usedPercent: 9, resetsAt: Date.UTC(2026, 10, 21, 5, 59) })
})

test('janela de 5h não iniciada: 0% sem reset', () => {
  const u = parseUsageText('Current session: 0% used\nCurrent week (all models): 25% used · resets Nov 18 at 5am (America/Sao_Paulo)', now)
  assert.deepEqual(u.fiveHour, { usedPercent: 0, resetsAt: null })
  assert.equal(u.sevenDay?.resetsAt, Date.UTC(2026, 10, 18, 8, 0))
})

test('sem login ou formato desconhecido: nada', () => {
  assert.deepEqual(parseUsageText('Total cost: $0.0000\nUsage: 0 input', now), { fiveHour: null, sevenDay: null })
})

test('reset só com hora vira hoje ou amanhã', () => {
  assert.equal(parseReset('resets 3:39pm (America/Sao_Paulo)', now), Date.UTC(2026, 10, 14, 18, 39))
  assert.equal(parseReset('resets 9am (America/Sao_Paulo)', now), Date.UTC(2026, 10, 15, 12, 0))
})

test('virada de ano', () => {
  const dec = Date.UTC(2026, 11, 30, 12, 0)
  assert.equal(parseReset('resets Jan 2 at 1am (UTC)', dec), Date.UTC(2027, 0, 2, 1, 0))
})

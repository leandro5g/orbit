import type { AccountView, Work } from './types.ts'

/** Uso que mais aperta na conta: o maior entre a janela de 5h e a semana. Janela renovada conta como 0. */
export function pressure(a: Pick<AccountView, 'usage'>): number | null {
  const vals = [a.usage.fiveHour, a.usage.sevenDay]
    .filter((w) => w)
    .map((w) => (w!.renewed ? 0 : w!.usedPercent))
    .filter((v): v is number => v != null)
  return vals.length ? Math.max(...vals) : null
}

/** Conta com mais folga para continuar, fora a `exclude`. Ignora contas sem login ou esgotadas. */
export function recommendAccount(accounts: AccountView[], exclude?: string | null): AccountView | null {
  const ok = accounts.filter((a) => a.id !== exclude && !a.needsLogin && (pressure(a) ?? 0) < 100)
  return [...ok].sort((x, y) => (pressure(x) ?? 50) - (pressure(y) ?? 50))[0] ?? null
}

/**
 * Contas que pedem troca: a partir do aviso (switchAlertAt) com sessão rodando, ou esgotadas com
 * qualquer trabalho aberto (a sessão pode ter fechado depois de bater no limite).
 */
export function accountsNeedingSwitch(accounts: AccountView[], works: Work[], switchAlertAt: number): AccountView[] {
  return accounts.filter((a) => {
    const p = pressure(a) ?? 0
    const mine = works.filter((w) => w.accountId === a.id && w.status !== 'done')
    return p >= 100 ? mine.length > 0 : p >= switchAlertAt && mine.some((w) => w.status === 'active')
  })
}

/** Quando a conta esgotada volta: o reset da janela que está em 100%. */
export function backAt(a: Pick<AccountView, 'usage'>): number | null {
  const full = [a.usage.fiveHour, a.usage.sevenDay].filter((w) => w && !w.renewed && (w.usedPercent ?? 0) >= 100)
  const resets = full.map((w) => w!.resetsAt).filter((t): t is number => t != null)
  return resets.length ? Math.max(...resets) : null
}

export interface NoteSummary {
  title: string | null
  doneItems: number | null
  totalItems: number | null
  next: string | null
  by: 'claude' | 'orbit' | null
}

/** Lê o resumo do registro de continuação: título, checklist (- [x] / - [ ]) e o próximo passo. */
export function parseNote(md: string): NoteSummary {
  const lines = md.split(/\r?\n/)
  const title = lines.find((l) => /^#\s+\S/.test(l))?.replace(/^#\s+/, '').trim() ?? null
  let done = 0
  let total = 0
  for (const l of lines) {
    const m = /^\s*[-*]\s+\[( |x|X)\]/.exec(l)
    if (!m) continue
    total++
    if (m[1] !== ' ') done++
  }
  let next: string | null = null
  const i = lines.findIndex((l) => /^##\s+Pr[óo]ximo passo/i.test(l))
  if (i >= 0) {
    const line = lines.slice(i + 1).find((l) => l.trim() && !l.startsWith('#'))
    next = line ? line.replace(/^\s*[-*]\s+(\[[ xX]\]\s+)?/, '').trim() || null : null
  }
  // O rascunho do Orbit leva uma marca; quando o Claude reescreve o arquivo, ela some.
  const by = !md.trim() ? null : /<!--\s*orbit:by=orbit\s*-->/.test(md) ? 'orbit' : 'claude'
  return { title, doneItems: total ? done : null, totalItems: total || null, next, by }
}

import { useState } from 'react'
import { formatClock } from '../../../shared/format'
import type { AccountView, Work } from '../../../shared/types'
import { pressure, recommendAccount } from '../../../shared/works'
import { useOrbit } from '../store'
import { Copyable } from './MainView'
import { usageTone } from './ui'

/** Abre o trabalho na conta escolhida. Devolve o comando quando o Terminal não abriu sozinho. */
export async function continueWork(w: Work, a: AccountView): Promise<string | null> {
  const r = await window.orbit.continueWork(w.id, a.id)
  useOrbit.getState().showToast(r)
  return r.ok && r.command && !r.opened ? r.command : null
}

/** Continua vários trabalhos na mesma conta. Devolve os comandos que não abriram sozinhos. */
export async function continueMany(works: Work[], a: AccountView): Promise<string[]> {
  const cmds: string[] = []
  for (const w of works) {
    const c = await continueWork(w, a)
    if (c) cmds.push(c)
  }
  return cmds
}

/** "5h 18% · semana 63%", ou quando volta, se a conta estiver esgotada. */
function usageLine(a: AccountView, now: number): string {
  if (a.needsLogin) return 'sem login'
  const full = [a.usage.fiveHour, a.usage.sevenDay].find((x) => x && !x.renewed && (x.usedPercent ?? 0) >= 100)
  if (full?.resetsAt) return `esgotada · volta às ${formatClock(full.resetsAt, now)}`
  const part = (label: string, w: AccountView['usage']['fiveHour']) =>
    w ? `${label} ${w.renewed ? 'renovada' : `${w.usedPercent}%`}` : null
  return [part('5h', a.usage.fiveHour), part('semana', a.usage.sevenDay)].filter(Boolean).join(' · ') || 'uso ainda não lido'
}

/** Escolhe a conta e quais trabalhos levar, e continua com um botão só. */
export function SwitchView() {
  const snapshot = useOrbit((s) => s.snapshot)!
  const now = useOrbit((s) => s.now)
  const switchFrom = useOrbit((s) => s.switchFrom)
  const switchWork = useOrbit((s) => s.switchWork)
  const works = snapshot.works ?? []
  const focus = works.find((w) => w.id === switchWork) ?? null

  // Origem: a conta do trabalho clicado, a pedida (notificação/faixa) ou a mais cheia com trabalho aberto.
  const withWork = snapshot.accounts.filter((a) => works.some((w) => w.accountId === a.id && w.status !== 'done'))
  const from =
    snapshot.accounts.find((a) => a.id === (focus?.accountId ?? switchFrom)) ??
    [...withWork].sort((a, b) => (pressure(b) ?? 0) - (pressure(a) ?? 0))[0] ??
    snapshot.accounts.find((a) => a.id === snapshot.selectedId)

  const candidates = works.filter((w) => w.accountId === from?.id && w.status !== 'done')
  // Trabalho parado pode voltar para a própria conta; o que está rodando, não.
  const stayAllowed = focus?.status === 'paused'
  const targets = snapshot.accounts.filter((a) => stayAllowed || a.id !== from?.id)
  const best = recommendAccount(targets, null)
  const [target, setTarget] = useState<string | null>(best?.id ?? null)
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(focus ? [focus.id] : candidates.map((w) => w.id))
  )
  const [busy, setBusy] = useState(false)
  const [commands, setCommands] = useState<string[]>([])

  if (!from) return <p className="empty">Nenhuma conta.</p>
  const to = targets.find((a) => a.id === target) ?? null
  const pct = pressure(from)
  // Com um trabalho só não há o que escolher: ele vai.
  const chosen = candidates.length === 1 ? candidates : candidates.filter((w) => picked.has(w.id))

  const go = async () => {
    if (!to) return
    setBusy(true)
    const cmds = await continueMany(chosen, to)
    setCommands(cmds)
    setBusy(false)
    if (!cmds.length) useOrbit.getState().setView('sessions')
  }

  return (
    <div className="switch">
      <p className="switch-lead">
        {pct != null && pct >= 100 ? (
          <>
            <strong>{from.name}</strong> esgotou.
          </>
        ) : (
          <>
            <strong>{from.name}</strong> está em <span className={`tone-text-${usageTone(pct)}`}>{pct ?? '—'}%</span>.
          </>
        )}{' '}
        O Claude abre na mesma pasta, na conta escolhida, lendo o registro do trabalho.
      </p>

      <h3>Continuar em</h3>
      <div className="options" role="radiogroup">
        {targets.map((a) => {
          const p = pressure(a)
          const out = a.needsLogin || (p ?? 0) >= 100
          return (
            <button
              key={a.id}
              role="radio"
              aria-checked={target === a.id}
              className={`option ${target === a.id ? 'on' : ''}`}
              disabled={out}
              onClick={() => setTarget(a.id)}
            >
              <span className="radio" />
              <span className="option-body">
                <span className="option-title">
                  {a.name}
                  {a.id === from.id && <span className="muted"> · onde parou</span>}
                </span>
                <span className="muted small">{usageLine(a, now)}</span>
              </span>
              {best?.id === a.id && <span className="tag">mais folga</span>}
            </button>
          )
        })}
      </div>
      {targets.length <= 1 && (
        <button className="link" onClick={() => useOrbit.getState().setView('add')}>
          Adicionar outra conta
        </button>
      )}

      {candidates.length > 1 && (
        <>
          <h3>Levar</h3>
          <ul className="switch-works">
            {candidates.map((w) => (
              <li key={w.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={picked.has(w.id)}
                    onChange={(e) => {
                      const next = new Set(picked)
                      if (e.currentTarget.checked) next.add(w.id)
                      else next.delete(w.id)
                      setPicked(next)
                    }}
                  />
                  <span className="switch-work-text">
                    <span className="switch-work-title">{w.title}</span>
                    <span className="muted small">
                      {w.project} · {w.noteAt ? 'registro salvo' : 'registro feito na hora'}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
      {candidates.length === 1 && (
        <p className="switch-single">
          <span className="switch-work-title">{candidates[0].title}</span>
          <span className="muted small">
            {candidates[0].project} · {candidates[0].noteAt ? 'registro salvo' : 'registro feito na hora'}
          </span>
        </p>
      )}
      {!candidates.length && <p className="muted small">Nenhum trabalho aberto em {from.name}.</p>}

      <button className="btn primary wide" disabled={!to || !chosen.length || busy} onClick={() => void go()}>
        {busy
          ? 'Abrindo…'
          : !to
            ? 'Escolha uma conta'
            : chosen.length > 1
              ? `Continuar ${chosen.length} trabalhos em ${to.name}`
              : `Continuar em ${to.name}`}
      </button>
      {snapshot.settings.handoffFullHistory && (
        <p className="footnote">Levando a conversa inteira (Ajustes): a conta nova começa com todo o histórico.</p>
      )}
      {commands.map((c) => (
        <Copyable key={c} text={c} />
      ))}
    </div>
  )
}

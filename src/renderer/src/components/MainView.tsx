import { useState } from 'react'
import { formatAgo, formatClock, formatElapsed, formatRemaining, mostRelevant } from '../../../shared/format'
import type { AccountView, Session, Usage } from '../../../shared/types'
import type { Work } from '../../../shared/types'
import { accountsNeedingSwitch, backAt, pressure, recommendAccount } from '../../../shared/works'
import { Calendar, Check, Clock, Terminal, Trend } from '../icons'
import { useOrbit } from '../store'
import { Bar, Dot, Lines, Spinner, StatePill, usageTone } from './ui'
import { continueMany } from './SwitchView'

export function AccountList({ accounts, selectedId }: { accounts: AccountView[]; selectedId: string | null }) {
  const [editing, setEditing] = useState<string | null>(null)
  if (!accounts.length) return null
  return (
    <ul className="accounts">
      {accounts.map((a) => {
        const pct = a.usage.fiveHour?.usedPercent
        const selected = a.id === selectedId
        const out = (pressure(a) ?? 0) >= 100
        const back = out ? backAt(a) : null
        return (
          <li key={a.id}>
            <button
              className={`account ${selected ? 'selected' : ''}`}
              onClick={() => void window.orbit.selectAccount(a.id)}
              onDoubleClick={() => setEditing(a.id)}
              title={[a.email, a.organization, a.configDir].filter(Boolean).join(' · ')}
            >
              <Dot state={a.state} />
              {editing === a.id ? (
                <input
                  className="rename"
                  autoFocus
                  defaultValue={a.name}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={(e) => {
                    void window.orbit.renameAccount(a.id, e.currentTarget.value)
                    setEditing(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur()
                    if (e.key === 'Escape') setEditing(null)
                  }}
                />
              ) : (
                <span className="account-name">
                  {a.name}
                  {a.email && <span className="account-email">{a.email}</span>}
                </span>
              )}
              <span
                className={`account-pct ${a.alert ? `tone-text-${usageTone(pct)}` : ''}`}
                title={
                  a.usage.fiveHour?.renewed
                    ? 'Janela renovada; sem leitura nova do Claude Code'
                    : a.alert
                      ? 'Uso alto ou esgotamento previsto'
                      : undefined
                }
              >
                {out ? (
                  <span className="tone-text-red" title={back ? `Volta às ${formatClock(back)}` : undefined}>
                    esgotou
                  </span>
                ) : pct != null ? (
                  `${pct}%`
                ) : (
                  '—'
                )}
              </span>
              <span className="account-check">{selected && <Check size={16} />}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function sessionSubline(s: Session): string {
  const parts: string[] = []
  const c = s.changes
  if (c) {
    const files = c.filesModified + c.filesAdded + c.filesDeleted
    if (files) parts.push(`${s.state === 'working' ? 'Alterando' : 'Alterou'} ${files} ${files === 1 ? 'arquivo' : 'arquivos'}`)
  }
  if (s.tool && (s.state === 'working' || s.state === 'approval')) parts.unshift(s.tool)
  if (!parts.length) parts.push(c ? 'Sem alterações pendentes no repo' : 'Fora de um repositório git')
  return parts.join(' · ')
}

export function ActivityCard({ session, now, onClick }: { session: Session; now: number; onClick?: () => void }) {
  const running = session.state === 'working' || session.state === 'thinking'
  const lines = session.claudeLinesAdded != null ? session : null
  return (
    <button className="activity" onClick={onClick}>
      <Terminal className="activity-icon" />
      <span className="activity-body">
        <span className="activity-title">{session.title}</span>
        <span className="activity-sub">
          {sessionSubline(session)}
          {lines && (
            <>
              {' · '}
              <Lines added={lines.claudeLinesAdded} removed={lines.claudeLinesRemoved} />
            </>
          )}
        </span>
        <span className="activity-meta">
          {session.project}
          {session.changes?.branch && ` · ${session.changes.branch}`}
          {session.model && ` · ${session.model}`}
        </span>
      </span>
      <span className="activity-time">
        {running ? formatElapsed(now - session.stateSince) : formatAgo(session.stateSince, now)}
        {running && <Spinner />}
      </span>
    </button>
  )
}

function Limit({
  icon,
  label,
  pct,
  resetsAt,
  renewed,
  tone,
  now
}: {
  icon: React.ReactNode
  label: string
  pct: number | null
  resetsAt: number | null
  renewed: boolean
  tone: 'green' | 'yellow' | 'red' | 'purple'
  now: number
}) {
  return (
    <div className="limit">
      <span className="limit-icon">{icon}</span>
      <div className="limit-body">
        <div className="limit-row">
          <span className="limit-label">{label}</span>
          <span className="limit-value">
            {renewed ? (
              <span className="muted">Renovada · aguardando nova leitura</span>
            ) : (
              <>
                <strong>{pct}%</strong>
                <span className="muted">
                  {' · '}
                  {resetsAt
                    ? `renova em ${formatRemaining(resetsAt - now)}${resetsAt - now < 20 * 3600_000 ? ` · ${formatClock(resetsAt, now)}` : ''}`
                    : 'janela não iniciada'}
                </span>
              </>
            )}
          </span>
        </div>
        <Bar pct={renewed ? 0 : pct} tone={tone} />
      </div>
    </div>
  )
}

export function Limits({ usage, now }: { usage: Usage; now: number }) {
  const { fiveHour, sevenDay } = usage
  return (
    <section className="limits">
      {fiveHour ? (
        <Limit
          icon={<Clock size={20} />}
          label="Janela de 5 horas"
          pct={fiveHour.usedPercent}
          resetsAt={fiveHour.resetsAt}
          renewed={fiveHour.renewed}
          tone={usageTone(fiveHour.usedPercent)}
          now={now}
        />
      ) : null}
      {sevenDay ? (
        <Limit
          icon={<Calendar size={20} />}
          label="Uso semanal"
          pct={sevenDay.usedPercent}
          resetsAt={sevenDay.resetsAt}
          renewed={sevenDay.renewed}
          tone={sevenDay.usedPercent != null && sevenDay.usedPercent >= 90 ? 'red' : 'purple'}
          now={now}
        />
      ) : null}
    </section>
  )
}

export function ForecastLine({ usage, now }: { usage: Usage; now: number }) {
  const f = usage.forecast
  const w = usage.fiveHour
  // Já esgotada: não há o que prever.
  if (!w || w.renewed || (w.usedPercent ?? 0) >= 100) return null
  if (!f) return null
  const text =
    f.exhaustAt && f.beforeReset ? (
      <>
        No ritmo atual, esgota por volta de <strong>{formatClock(f.exhaustAt, now)}</strong>
      </>
    ) : (
      'No ritmo atual, não esgota antes de renovar'
    )
  return (
    <div className={`forecast ${f.beforeReset ? 'warn' : ''}`} title={`Estimativa · ${f.ratePerHour}%/h · confiança ${f.confidence}`}>
      <Trend size={14} />
      <span>{text}</span>
    </div>
  )
}

function Copyable({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <div className="copyable">
      <code>{text}</code>
      <button
        className="btn ghost small-btn"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text)
            setDone(true)
            setTimeout(() => setDone(false), 1500)
          } catch {
            /* seleção manual continua possível */
          }
        }}
      >
        {done ? 'Copiado' : 'Copiar'}
      </button>
    </div>
  )
}

/** Conta esgotada (ou quase): diz isso e lista as sessões dela, cada uma com um botão para continuar em outra conta. */
function SwitchPanel({ from }: { from: AccountView }) {
  const snapshot = useOrbit((s) => s.snapshot)!
  const now = useOrbit((s) => s.now)
  const [busy, setBusy] = useState<string | null>(null)
  const [commands, setCommands] = useState<string[]>([])
  const works = (snapshot.works ?? [])
    .filter((w) => w.accountId === from.id && w.status !== 'done')
    .sort((a, b) => (a.status === b.status ? b.updatedAt - a.updatedAt : a.status === 'active' ? -1 : 1))
  const pct = pressure(from) ?? 0
  const out = pct >= 100
  const back = backAt(from)
  const f = from.usage.forecast
  const best = recommendAccount(snapshot.accounts, from.id)
  const others = snapshot.accounts.filter((a) => a.id !== from.id)
  const [target, setTarget] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  // Conta escolhida em "Mudar conta"; sem escolha, a de mais folga.
  const to = others.find((a) => a.id === target && !a.needsLogin && (pressure(a) ?? 0) < 100) ?? best

  const go = async (w: Work) => {
    if (!to) return
    setBusy(w.id)
    const cmds = await continueMany([w], to)
    setCommands((c) => [...c, ...cmds])
    setBusy(null)
  }

  return (
    <section className={`switch-panel ${out ? 'out' : ''}`}>
      <div className="switch-panel-head">
        <span className="switch-panel-title">
          {from.name} {out ? 'esgotou' : `em ${pct}%`}
        </span>
        <span className="muted small">
          {out && back
            ? `volta às ${formatClock(back, now)}`
            : f?.exhaustAt && f.beforeReset
              ? `esgota às ${formatClock(f.exhaustAt, now)}`
              : ''}
        </span>
      </div>
      {to && (
        <div className="switch-target">
          <span className="muted small">
            Continuar em <strong>{to.name}</strong> ({pressure(to) ?? '—'}%)
          </span>
          <button className="text-btn strong" onClick={() => setPicking(!picking)}>
            {picking ? 'Fechar' : 'Mudar conta'}
          </button>
        </div>
      )}
      {picking && (
        <div className="target-list">
          {others.map((a) => {
            const p = pressure(a)
            const full = a.needsLogin || (p ?? 0) >= 100
            return (
              <button
                key={a.id}
                className={`target ${to?.id === a.id ? 'on' : ''}`}
                disabled={full}
                onClick={() => {
                  setTarget(a.id)
                  setPicking(false)
                }}
              >
                <span>{a.name}</span>
                <span className="muted">{a.needsLogin ? 'sem login' : full ? 'esgotou' : `${p ?? '—'}%`}</span>
              </button>
            )
          })}
          <button className="target add" onClick={() => useOrbit.getState().setView('add')}>
            + Adicionar conta
          </button>
        </div>
      )}
      <ul className="switch-rows">
        {works.map((w) => (
          <li key={w.id}>
            <span className="switch-row-text" title={w.title}>
              <span className="switch-work-title">{w.title}</span>
              <span className="muted small">{w.project}</span>
            </span>
            {to && (
              <button className="btn primary small-btn" disabled={busy != null} onClick={() => void go(w)}>
                {busy === w.id ? 'Abrindo…' : `Continuar em ${to.name}`}
              </button>
            )}
          </li>
        ))}
      </ul>
      {!to && (
        <p className="muted small switch-panel-note">
          Nenhuma outra conta com folga.{' '}
          <button className="text-btn strong" onClick={() => useOrbit.getState().setView('add')}>
            Adicionar conta
          </button>
        </p>
      )}
      {commands.map((c) => (
        <Copyable key={c} text={c} />
      ))}
    </section>
  )
}

/** Primeira execução sem Claude Code: diz como instalar ou onde apontar. */
function ClaudeMissing() {
  const showToast = useOrbit((s) => s.showToast)
  return (
    <div className="hint">
      <h2>Claude Code não encontrado</h2>
      <p>O Orbit lê o uso pelo próprio Claude Code. Instale com o comando abaixo e clique em Verificar.</p>
      <Copyable text="curl -fsSL https://claude.ai/install.sh | bash" />
      <div className="row-actions">
        <button className="btn" onClick={() => void window.orbit.checkClaude()}>
          Verificar de novo
        </button>
        <button className="btn ghost" onClick={async () => showToast(await window.orbit.pickClaudePath())}>
          Já tenho: escolher arquivo
        </button>
      </div>
    </div>
  )
}

function NeedsLogin({ acc }: { acc: AccountView }) {
  const showToast = useOrbit((s) => s.showToast)
  return (
    <div className="hint">
      <h2>{acc.name} ainda não fez login</h2>
      <p>O login é feito pelo próprio Claude Code, no navegador. O Orbit não vê senha nem token.</p>
      <div className="row-actions">
        <button className="btn" onClick={async () => showToast(await window.orbit.loginAccount(acc.id))}>
          Fazer login
        </button>
      </div>
    </div>
  )
}

function DetailsHint({ acc }: { acc: AccountView }) {
  const showToast = useOrbit((s) => s.showToast)
  return (
    <div className="details-hint">
      <p>
        <strong>Ativar detalhes das sessões?</strong> Mostra aprovação pendente, erro, a ferramenta em uso e o uso em
        tempo real. Adiciona a statusline e hooks do Orbit ao settings.json (com backup).
      </p>
      <div className="row-actions">
        <button className="btn" onClick={async () => showToast(await window.orbit.installIntegration(acc.id))}>
          Ativar
        </button>
        <button className="btn ghost" onClick={() => void window.orbit.updateSettings({ integrationHintDismissed: true })}>
          Agora não
        </button>
      </div>
    </div>
  )
}

export function MainView() {
  const snapshot = useOrbit((s) => s.snapshot)!
  const now = useOrbit((s) => s.now)
  const setView = useOrbit((s) => s.setView)
  const acc = snapshot.accounts.find((a) => a.id === snapshot.selectedId) ?? null
  const session = acc ? mostRelevant(acc.sessions) : null
  const hasUsage = !!(acc?.usage.fiveHour || acc?.usage.sevenDay)
  const work = session ? (snapshot.works ?? []).find((w) => w.sessionId === session.id && w.status !== 'done') : null
  const needSwitch = accountsNeedingSwitch(snapshot.accounts, snapshot.works ?? [], snapshot.settings.switchAlertAt).sort(
    (a, b) => (pressure(b) ?? 0) - (pressure(a) ?? 0)
  )
  const canSwitch = !!work && snapshot.accounts.length > 1 && !needSwitch.some((a) => a.id === acc?.id)

  return (
    <>
      {needSwitch.map((a) => (
        <SwitchPanel key={a.id} from={a} />
      ))}
      <AccountList accounts={snapshot.accounts} selectedId={snapshot.selectedId} />
      {!snapshot.claudePath ? (
        <>
          {snapshot.accounts.length > 0 && <hr />}
          <ClaudeMissing />
        </>
      ) : (
        !snapshot.accounts.length && (
          <div className="hint">
            <h2>Nenhuma conta ainda</h2>
            <p>Crie uma com o + ou abra o Claude Code uma vez no terminal para fazer o login.</p>
          </div>
        )
      )}
      {acc && snapshot.claudePath && acc.needsLogin && (
        <>
          <hr />
          <NeedsLogin acc={acc} />
        </>
      )}
      {acc && !acc.needsLogin && (
        <>
          <hr />
          <section className="activity-section">
            <div className="section-head">
              <h2>
                Atividade <span className="muted">({acc.name})</span>
              </h2>
              <StatePill state={acc.state} />
            </div>
            {session ? (
              <ActivityCard session={session} now={now} onClick={() => setView('sessions')} />
            ) : (
              <p className="empty">Nenhuma sessão do Claude Code aberta nesta conta.</p>
            )}
            {(acc.sessions.length > 1 || canSwitch) && (
              <div className="activity-foot">
                {acc.sessions.length > 1 ? (
                  <button className="text-btn" onClick={() => setView('sessions')}>
                    Ver as {acc.sessions.length} sessões
                  </button>
                ) : (
                  <span />
                )}
                {canSwitch && (
                  <button className="text-btn strong" onClick={() => useOrbit.getState().openSwitch(acc.id, work!.id)}>
                    Continuar em outra conta
                  </button>
                )}
              </div>
            )}
          </section>
          <hr />
          {hasUsage ? (
            <>
              <Limits usage={acc.usage} now={now} />
              <ForecastLine usage={acc.usage} now={now} />
            </>
          ) : (
            <p className="empty">{snapshot.claudePath ? 'Lendo o uso no Claude Code…' : 'Uso indisponível sem o Claude Code.'}</p>
          )}
          {acc.usage.observedAt && now - acc.usage.observedAt > 5 * 60_000 && (
            <p className="footnote">Uso lido do Claude Code {formatAgo(acc.usage.observedAt, now)}</p>
          )}
          {(!acc.integration.statusline || !acc.integration.hooks) &&
            !acc.integration.statuslineConflict &&
            !snapshot.settings.integrationHintDismissed && <DetailsHint acc={acc} />}
        </>
      )}
    </>
  )
}

export { Copyable }

import { useState } from 'react'
import { formatAgo, formatClock, formatElapsed, formatRemaining, mostRelevant } from '../../../shared/format'
import type { AccountView, Session, Usage } from '../../../shared/types'
import { Calendar, Check, Clock, Terminal, Trend } from '../icons'
import { useOrbit } from '../store'
import { Bar, Dot, Lines, Spinner, StatePill, usageTone } from './ui'

export function AccountList({ accounts, selectedId }: { accounts: AccountView[]; selectedId: string | null }) {
  const [editing, setEditing] = useState<string | null>(null)
  if (!accounts.length) return null
  return (
    <ul className="accounts">
      {accounts.map((a) => {
        const pct = a.usage.fiveHour?.usedPercent
        const selected = a.id === selectedId
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
                title={a.usage.fiveHour?.renewed ? 'Janela renovada; sem leitura nova do Claude Code' : undefined}
              >
                {a.alert && <span className="alert-mark" title="Uso alto ou esgotamento previsto">!</span>}
                {pct != null ? `${pct}%` : '—'}
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
  now,
  showClock
}: {
  icon: React.ReactNode
  label: string
  pct: number | null
  resetsAt: number | null
  renewed: boolean
  tone: 'green' | 'yellow' | 'red' | 'purple'
  now: number
  showClock?: boolean
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
                  {resetsAt ? `Renova em ${formatRemaining(resetsAt - now)}` : 'janela não iniciada'}
                </span>
              </>
            )}
          </span>
        </div>
        <Bar pct={renewed ? 0 : pct} tone={tone} />
        {showClock && !renewed && resetsAt && <div className="limit-clock">Renovação às {formatClock(resetsAt, now)}</div>}
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
          showClock
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
  if (!w || w.renewed) return null
  let text: React.ReactNode
  if (!f) text = 'Estimativa indisponível: poucas leituras recentes nesta janela.'
  else if (f.exhaustAt && f.beforeReset)
    text = (
      <>
        Esgota por volta de <strong>{formatClock(f.exhaustAt, now)}</strong>, antes do reset
      </>
    )
  else if (f.exhaustAt) text = <>No ritmo atual, não esgota antes do reset</>
  else text = <>Ritmo baixo: não esgota antes do reset</>
  return (
    <div className={`forecast ${f?.beforeReset ? 'warn' : ''}`}>
      <Trend size={15} />
      <span>
        {text}
        {f && (
          <span className="muted">
            {' · '}
            {f.ratePerHour}%/h · confiança {f.confidence}
          </span>
        )}
        <span className="estimate-tag">estimativa</span>
      </span>
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

  return (
    <>
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
            {acc.sessions.length > 1 && (
              <button className="link" onClick={() => setView('sessions')}>
                Ver as {acc.sessions.length} sessões
              </button>
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
          {acc.usage.observedAt && (
            <p className="footnote">
              Uso lido do Claude Code {formatAgo(acc.usage.observedAt, now)}
              {acc.usage.source === 'usage' ? ' · inclui o claude.ai' : ' · sessão aberta'}
            </p>
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

import { formatAgo, formatElapsed, formatRemaining, rank, STATE_LABEL } from '../../../shared/format'
import type { AccountView, Session } from '../../../shared/types'
import { useOrbit } from '../store'
import { Bar, Dot, Lines, usageTone } from './ui'

function Overview({ accounts, now }: { accounts: AccountView[]; now: number }) {
  return (
    <section className="overview">
      <h2>Todas as contas</h2>
      <table>
        <thead>
          <tr>
            <th />
            <th>5 horas</th>
            <th>Semana</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((a) => {
            const f = a.usage.fiveHour
            const w = a.usage.sevenDay
            return (
              <tr key={a.id}>
                <td>
                  <Dot state={a.state} /> {a.name}
                </td>
                <td>
                  {f && !f.renewed ? (
                    <>
                      <span className="ov-num">{f.usedPercent}%</span>
                      <Bar pct={f.usedPercent} tone={usageTone(f.usedPercent)} />
                      <span className="muted small">{f.resetsAt ? formatRemaining(f.resetsAt - now) : 'não iniciada'}</span>
                    </>
                  ) : (
                    <span className="muted">{f?.renewed ? 'renovada' : '—'}</span>
                  )}
                </td>
                <td>
                  {w && !w.renewed ? (
                    <>
                      <span className="ov-num">{w.usedPercent}%</span>
                      <Bar pct={w.usedPercent} tone="purple" />
                      <span className="muted small">{w.resetsAt ? formatRemaining(w.resetsAt - now) : 'não iniciada'}</span>
                    </>
                  ) : (
                    <span className="muted">{w?.renewed ? 'renovada' : '—'}</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}

function SessionRow({ s, now }: { s: Session; now: number }) {
  const running = s.state === 'working' || s.state === 'thinking'
  const c = s.changes
  return (
    <li className="session">
      <div className="session-head">
        <Dot state={s.state} />
        <span className="session-title" title={s.cwd}>
          {s.title}
        </span>
        <span className="session-state">{STATE_LABEL[s.state]}</span>
      </div>
      <div className="session-meta">
        <button className="link inline" onClick={() => window.orbit.openPath(c?.repoRoot ?? s.cwd)}>
          {s.project}
        </button>
        {c?.branch && <span> · {c.branch}</span>}
        {s.model && <span> · {s.model}</span>}
        {s.tool && <span> · {s.tool}</span>}
        <span className="muted">
          {' · '}
          {running ? `executando há ${formatElapsed(now - s.stateSince)}` : `atualizado ${formatAgo(s.updatedAt, now)}`}
        </span>
      </div>
      {(c || s.claudeLinesAdded != null) && (
        <div className="session-changes">
          {s.claudeLinesAdded != null && (
            <span title="Linhas escritas pelo Claude nesta sessão">
              Sessão <Lines added={s.claudeLinesAdded} removed={s.claudeLinesRemoved} />
            </span>
          )}
          {c && (
            <span title="Alterações não commitadas no repositório (git)">
              Repo: {c.filesModified} mod · {c.filesAdded} novos · {c.filesDeleted} rem ·{' '}
              <Lines added={c.linesAdded} removed={c.linesRemoved} />
            </span>
          )}
          {c?.lastFile && <span className="muted last-file">Último: {c.lastFile}</span>}
        </div>
      )}
    </li>
  )
}

export function SessionsView() {
  const snapshot = useOrbit((s) => s.snapshot)!
  const now = useOrbit((s) => s.now)
  const groups = snapshot.accounts
    .map((a) => ({ a, sessions: [...a.sessions].sort((x, y) => rank(x.state) - rank(y.state) || y.updatedAt - x.updatedAt) }))
    .filter((g) => g.sessions.length)

  // Repos com mais de uma sessão: a contagem do git é do repo, mostrada uma vez por repo.
  const repos = new Map<string, number>()
  for (const g of groups) for (const s of g.sessions) if (s.changes) repos.set(s.changes.repoRoot, (repos.get(s.changes.repoRoot) ?? 0) + 1)
  const shared = [...repos.values()].filter((n) => n > 1).length

  return (
    <>
      <Overview accounts={snapshot.accounts} now={now} />
      <hr />
      <section>
        <h2>Sessões ativas</h2>
        {!groups.length && <p className="empty">Nenhuma sessão do Claude Code aberta.</p>}
        {groups.map(({ a, sessions }) => (
          <div key={a.id} className="session-group">
            <h3>{a.name}</h3>
            <ul className="sessions">
              {sessions.map((s) => (
                <SessionRow key={s.id} s={s} now={now} />
              ))}
            </ul>
          </div>
        ))}
        {shared > 0 && (
          <p className="footnote">
            {shared === 1 ? 'Um repositório tem' : `${shared} repositórios têm`} mais de uma sessão: a contagem "Repo" é a
            mesma para elas, não some.
          </p>
        )}
      </section>
    </>
  )
}

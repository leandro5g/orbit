import { useState } from 'react'
import { formatAgo, formatElapsed, rank, STATE_LABEL } from '../../../shared/format'
import type { AccountView, Session, Work } from '../../../shared/types'
import { useOrbit } from '../store'
import { Dot, Lines, usageTone } from './ui'

function UsageSummary({ a }: { a: AccountView }) {
  const part = (label: string, w: AccountView['usage']['fiveHour']) =>
    w && (
      <span>
        {label} <span className={w.renewed ? 'muted' : `tone-text-${usageTone(w.usedPercent)}`}>{w.renewed ? 'renovada' : `${w.usedPercent}%`}</span>
      </span>
    )
  if (a.needsLogin) return <span className="group-usage">sem login</span>
  return (
    <span className="group-usage">
      {part('5h', a.usage.fiveHour)}
      {part('semana', a.usage.sevenDay)}
    </span>
  )
}

function noteStatus(w: Work, now: number): string {
  if (w.requestedAt) return 'Claude escrevendo o registro'
  if (w.noteAt) return `registro salvo ${formatAgo(w.noteAt, now)}`
  return 'sem registro'
}

function Progress({ w }: { w: Work }) {
  if (!w.totalItems && !w.next) return null
  return (
    <div className="item-line">
      {w.totalItems ? `${w.doneItems ?? 0} de ${w.totalItems} feitos` : ''}
      {w.totalItems && w.next ? ' · ' : ''}
      {w.next && <>próximo: {w.next}</>}
    </div>
  )
}

function Title({ w, fallback }: { w: Work | null; fallback: string }) {
  const [editing, setEditing] = useState(false)
  if (w && editing)
    return (
      <input
        className="rename"
        autoFocus
        defaultValue={w.title}
        onBlur={(e) => {
          void window.orbit.renameWork(w.id, e.currentTarget.value)
          setEditing(false)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') setEditing(false)
        }}
      />
    )
  return (
    <span className="item-title" title={w ? 'Clique duas vezes para renomear' : undefined} onDoubleClick={() => w && setEditing(true)}>
      {w?.title ?? fallback}
    </span>
  )
}

/** Ações do trabalho: continuar em outra conta (principal), registro e concluir. */
function WorkActions({ w, primary }: { w: Work; primary: string }) {
  const now = useOrbit((s) => s.now)
  const showToast = useOrbit((s) => s.showToast)
  const [note, setNote] = useState<string | null | undefined>(undefined)
  return (
    <>
      <div className="item-actions">
        <button className="btn small-btn" onClick={() => useOrbit.getState().openSwitch(w.accountId, w.id)}>
          {primary}
        </button>
        <button
          className="text-btn"
          onClick={async () => setNote(note === undefined ? await window.orbit.readWorkNote(w.id) : undefined)}
          title={noteStatus(w, now)}
        >
          {note === undefined ? 'Registro' : 'Fechar registro'}
        </button>
        {w.status === 'paused' && (
          <button className="text-btn" onClick={() => void window.orbit.finishWork(w.id)}>
            Concluir
          </button>
        )}
      </div>
      {note !== undefined && (
        <div className="work-note">
          <div className="work-note-head">
            <span className="muted small">{noteStatus(w, now)}</span>
            {w.status !== 'done' && (
              <button className="text-btn" onClick={async () => showToast(await window.orbit.saveWork(w.id))}>
                Salvar agora
              </button>
            )}
            {note && (
              <button className="text-btn" onClick={() => window.orbit.openPath(w.noteFile)}>
                Abrir arquivo
              </button>
            )}
          </div>
          {note ? <pre>{note}</pre> : <p className="muted small">Ainda não há registro. Use "Salvar agora".</p>}
        </div>
      )}
    </>
  )
}

function SessionItem({ s, w, now }: { s: Session; w: Work | null; now: number }) {
  const running = s.state === 'working' || s.state === 'thinking'
  return (
    <li className="item">
      <div className="item-head">
        <Dot state={s.state} />
        <Title w={w} fallback={s.title} />
        <span className="item-state">
          {STATE_LABEL[s.state]}
          {running ? ` · ${formatElapsed(now - s.stateSince)}` : ''}
        </span>
      </div>
      <div className="item-line muted">
        <button className="text-btn" onClick={() => window.orbit.openPath(s.changes?.repoRoot ?? s.cwd)} title={s.cwd}>
          {s.project}
        </button>
        {s.changes?.branch && ` · ${s.changes.branch}`}
        {s.model && ` · ${s.model}`}
        {s.claudeLinesAdded != null && (
          <>
            {' · '}
            <Lines added={s.claudeLinesAdded} removed={s.claudeLinesRemoved} />
          </>
        )}
        {!running && ` · ${formatAgo(s.updatedAt, now)}`}
      </div>
      {w && <Progress w={w} />}
      {w && <WorkActions w={w} primary="Continuar em outra conta" />}
    </li>
  )
}

function PausedItem({ w, accounts, now }: { w: Work; accounts: AccountView[]; now: number }) {
  const acc = accounts.find((a) => a.id === w.accountId)
  return (
    <li className="item">
      <div className="item-head">
        <span className="dot tone-yellow" />
        <Title w={w} fallback={w.title} />
        <span className="item-state">parado {formatAgo(w.updatedAt, now)}</span>
      </div>
      <div className="item-line muted">
        <button className="text-btn" onClick={() => window.orbit.openPath(w.cwd)} title={w.cwd}>
          {w.project}
        </button>
        {' · '}parou em {acc?.name ?? w.accountId}
      </div>
      <Progress w={w} />
      <WorkActions w={w} primary="Continuar" />
    </li>
  )
}

export function SessionsView() {
  const snapshot = useOrbit((s) => s.snapshot)!
  const now = useOrbit((s) => s.now)
  const [showDone, setShowDone] = useState(false)
  const works = snapshot.works ?? []
  const bySession = new Map(works.map((w) => [w.sessionId, w]))
  const live = new Set(snapshot.accounts.flatMap((a) => a.sessions.map((s) => s.id)))

  // Trabalho aberto sem sessão viva na tela: parado, esperando continuar.
  const paused = works.filter((w) => w.status !== 'done' && !live.has(w.sessionId))
  const done = works.filter((w) => w.status === 'done')

  return (
    <>
      {snapshot.accounts.map((a) => {
        const sessions = [...a.sessions].sort((x, y) => rank(x.state) - rank(y.state) || y.updatedAt - x.updatedAt)
        return (
          <section key={a.id} className="group">
            <div className="group-head">
              <h2>{a.name}</h2>
              <UsageSummary a={a} />
            </div>
            {sessions.length ? (
              <ul className="items">
                {sessions.map((s) => {
                  const w = bySession.get(s.id) ?? null
                  return <SessionItem key={s.id} s={s} w={w && w.status !== 'done' ? w : null} now={now} />
                })}
              </ul>
            ) : (
              <p className="empty">Nenhuma sessão aberta.</p>
            )}
          </section>
        )
      })}

      {paused.length > 0 && (
        <section className="group">
          <div className="group-head">
            <h2>Parados</h2>
            <span className="group-usage">esperando continuar</span>
          </div>
          <ul className="items">
            {paused.map((w) => (
              <PausedItem key={w.id} w={w} accounts={snapshot.accounts} now={now} />
            ))}
          </ul>
        </section>
      )}

      {done.length > 0 && (
        <section className="group">
          <button className="text-btn" onClick={() => setShowDone(!showDone)}>
            {showDone ? 'Esconder concluídos' : `Concluídos (${done.length})`}
          </button>
          {showDone && (
            <ul className="done-list">
              {done.map((w) => (
                <li key={w.id}>
                  <span className="item-title muted">{w.title}</span>
                  <button className="text-btn" onClick={() => void window.orbit.dismissWork(w.id)}>
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <p className="footnote">
        O registro de cada trabalho fica em <code>.orbit/trabalhos/</code> no projeto, fora do git, e é salvo sozinho em{' '}
        {snapshot.settings.handoffAt}% de uso.
      </p>
    </>
  )
}

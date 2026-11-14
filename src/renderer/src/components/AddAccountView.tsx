import { useState } from 'react'
import type { ActionResult } from '../../../shared/types'
import { useOrbit } from '../store'
import { Copyable } from './MainView'

type Result = ActionResult & { command?: string }

/** Alias para abrir a conta no dia a dia: alias claude-trabalho='CLAUDE_CONFIG_DIR="$HOME/.claude-trabalho" claude' */
function aliasFor(command: string): string | null {
  const m = command.match(/\.(claude-[\w-]+)/)
  return m ? `alias ${m[1]}='${command}'` : null
}

export function AddAccountView() {
  const showToast = useOrbit((s) => s.showToast)
  const setView = useOrbit((s) => s.setView)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || busy) return
    setBusy(true)
    const r = await window.orbit.createAccount(name)
    setBusy(false)
    setResult(r)
  }

  if (result?.ok) {
    const alias = result.command ? aliasFor(result.command) : null
    return (
      <section className="add">
        <h2>Falta só o login</h2>
        <p>{result.message}</p>
        {result.command && !result.message.includes('Terminal') && <Copyable text={result.command} />}
        <p className="muted">
          A conta aparece com o uso assim que o login terminar. Para abrir o Claude Code nela depois, adicione ao seu
          shell:
        </p>
        {alias && <Copyable text={alias} />}
        <div className="row-actions">
          <button className="btn" onClick={() => setView('main')}>
            Pronto
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="add">
      <form onSubmit={create} className="add-form">
        <label htmlFor="account-name">Nome da conta</label>
        <input
          id="account-name"
          className="rename"
          autoFocus
          placeholder="Ex.: Trabalho"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.currentTarget.value)}
        />
        <p className="muted small">
          O Orbit cria uma pasta própria do Claude Code para essa conta e abre o Terminal. O login é o oficial, no
          navegador; o Orbit não vê senha nem token.
        </p>
        {result && !result.ok && <p className="error">{result.message}</p>}
        <div className="row-actions">
          <button className="btn" type="submit" disabled={!name.trim() || busy}>
            {busy ? 'Criando…' : 'Criar e fazer login'}
          </button>
        </div>
      </form>
      <hr />
      <button className="link" onClick={async () => showToast(await window.orbit.addAccount())}>
        Usar uma pasta que já existe (CLAUDE_CONFIG_DIR)
      </button>
    </section>
  )
}

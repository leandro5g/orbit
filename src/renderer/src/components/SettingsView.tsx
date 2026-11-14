import type { Settings } from '../../../shared/types'
import { Refresh, Trash } from '../icons'
import { useOrbit } from '../store'
import { Copyable } from './MainView'

const THRESHOLDS = [50, 70, 85, 95]

function Toggle({ label, k, settings }: { label: string; k: keyof Settings; settings: Settings }) {
  return (
    <label className="toggle">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={Boolean(settings[k])}
        onChange={(e) => void window.orbit.updateSettings({ [k]: e.currentTarget.checked })}
      />
    </label>
  )
}

export function SettingsView() {
  const snapshot = useOrbit((s) => s.snapshot)!
  const showToast = useOrbit((s) => s.showToast)
  const { settings } = snapshot

  return (
    <>
      <section>
        <h2>Contas</h2>
        <ul className="settings-accounts">
          {snapshot.accounts.map((a) => (
            <li key={a.id}>
              <div className="sa-row">
                <input
                  className="rename"
                  defaultValue={a.name}
                  aria-label={`Nome da conta ${a.id}`}
                  onBlur={(e) => {
                    if (e.currentTarget.value !== a.name) void window.orbit.renameAccount(a.id, e.currentTarget.value)
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                />
                <button
                  className="icon-btn"
                  title="Atualizar conexão (refaz o login)"
                  onClick={async () => showToast(await window.orbit.loginAccount(a.id))}
                >
                  <Refresh size={15} />
                </button>
                <button className="icon-btn" title="Remover do Orbit" onClick={() => void window.orbit.removeAccount(a.id)}>
                  <Trash size={15} />
                </button>
              </div>
              <div className="muted small">
                {a.email ?? 'e-mail indisponível'} · {a.configDir.replace(/^\/Users\/[^/]+/, '~')}
              </div>
              {a.needsLogin ? (
                <button className="link inline small" onClick={async () => showToast(await window.orbit.loginAccount(a.id))}>
                  Fazer login
                </button>
              ) : (
                <Copyable text={a.launchCommand} />
              )}
              <div className="small integration">
                <span className={a.integration.statusline ? 'ok' : 'off'}>statusline {a.integration.statusline ? '✓' : '✗'}</span>
                <span className={a.integration.hooks ? 'ok' : 'off'}>hooks {a.integration.hooks ? '✓' : '✗'}</span>
                {(!a.integration.statusline || !a.integration.hooks) && (
                  <button className="link inline" onClick={async () => showToast(await window.orbit.installIntegration(a.id))}>
                    Instalar
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
        <div className="row-actions">
          <button className="btn" onClick={() => useOrbit.getState().setView('add')}>
            Nova conta
          </button>
          {settings.hiddenAccounts.length > 0 && (
            <button className="btn ghost" onClick={() => void window.orbit.restoreAccounts()}>
              Mostrar removidas ({settings.hiddenAccounts.length})
            </button>
          )}
        </div>
        <p className="footnote">
          O Orbit não pede senha nem lê tokens: o login e a leitura do uso são feitos pelo próprio Claude Code. Cada
          conta é uma pasta do Claude Code (CLAUDE_CONFIG_DIR). A statusline e os hooks são opcionais e trazem
          aprovação, erro, ferramenta em uso e uso em tempo real.
        </p>
      </section>
      <hr />
      <section>
        <h2>Alertas</h2>
        <Toggle label="Alertas de uso" k="alertsEnabled" settings={settings} />
        <div className="thresholds">
          {THRESHOLDS.map((t) => {
            const on = settings.thresholds.includes(t)
            return (
              <button
                key={t}
                className={`chip ${on ? 'on' : ''}`}
                onClick={() =>
                  void window.orbit.updateSettings({
                    thresholds: on ? settings.thresholds.filter((x) => x !== t) : [...settings.thresholds, t].sort((x, y) => x - y)
                  })
                }
              >
                {t}%
              </button>
            )
          })}
        </div>
        <Toggle label="Esgotamento previsto antes do reset" k="notifyExhaustion" settings={settings} />
        <Toggle label="Renovação da janela de 5h" k="notifyReset" settings={settings} />
        <Toggle label="Sessão pedindo aprovação" k="notifyApproval" settings={settings} />
        <Toggle label="Erro em sessão" k="notifyError" settings={settings} />
        <Toggle label="Tarefa concluída" k="notifyCompletion" settings={settings} />
      </section>
      <hr />
      <section>
        <h2>Geral</h2>
        <Toggle label="Abrir ao iniciar sessão" k="openAtLogin" settings={settings} />
        <div className="claude-path small">
          <span className="muted">Claude Code:</span>{' '}
          {snapshot.claudePath ? <code>{snapshot.claudePath.replace(/^\/Users\/[^/]+/, '~')}</code> : 'não encontrado'}{' '}
          <button className="link inline" onClick={async () => showToast(await window.orbit.pickClaudePath())}>
            Alterar
          </button>
        </div>
        <div className="row-actions">
          <button className="btn ghost danger" onClick={() => window.orbit.quit()}>
            Sair do Orbit
          </button>
        </div>
      </section>
    </>
  )
}

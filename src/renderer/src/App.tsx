import { useEffect, useRef } from 'react'
import { Back, Expand, Gear, Plus, Sparkle } from './icons'
import { MainView } from './components/MainView'
import { SessionsView } from './components/SessionsView'
import { SettingsView } from './components/SettingsView'
import { AddAccountView } from './components/AddAccountView'
import { SwitchView } from './components/SwitchView'
import { useOrbit } from './store'

const TITLES = {
  main: 'Orbit',
  sessions: 'Sessões',
  settings: 'Ajustes',
  add: 'Nova conta',
  switch: 'Trocar de conta'
} as const

export function App() {
  const { snapshot, view, toast, setSnapshot, setView, tick } = useOrbit()
  const panel = useRef<HTMLDivElement>(null)
  // Trabalho parado esperando continuar: um ponto no ícone de sessões, sem número.
  const waiting = snapshot?.works?.some((w) => w.status === 'paused') ?? false

  useEffect(() => {
    void window.orbit.getSnapshot().then(setSnapshot)
    const offSnap = window.orbit.onSnapshot(setSnapshot)
    const offShown = window.orbit.onShown(() => {
      tick()
      setView('main')
    })
    // A notificação "trocar de conta?" abre o Orbit direto na tela de troca.
    const offNav = window.orbit.onNavigate((to) => {
      if (to.view === 'switch') useOrbit.getState().openSwitch(to.from ?? null)
      else setView('sessions')
    })
    const timer = setInterval(tick, 1000)
    return () => {
      offSnap()
      offShown()
      offNav()
      clearInterval(timer)
    }
  }, [setSnapshot, setView, tick])

  // A janela acompanha a altura do conteúdo.
  useEffect(() => {
    const el = panel.current
    if (!el) return
    const ro = new ResizeObserver(() => window.orbit.resize(el.getBoundingClientRect().height + 20))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && view !== 'main' && setView('main')
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, setView])

  return (
    <div className="panel" ref={panel}>
      <header className="header">
        {view === 'main' ? (
          <Sparkle className="logo" />
        ) : (
          <button className="icon-btn" onClick={() => setView('main')} aria-label="Voltar">
            <Back size={18} />
          </button>
        )}
        <h1>{TITLES[view]}</h1>
        <div className="header-actions">
          {view === 'main' && (
            <>
              <button
                className="icon-btn badge-host"
                title={waiting ? 'Sessões · há trabalho parado' : 'Sessões e trabalhos'}
                onClick={() => setView('sessions')}
              >
                <Expand size={17} />
                {waiting && <span className="badge-dot" />}
              </button>
              <button className="icon-btn" title="Adicionar conta" onClick={() => setView('add')}>
                <Plus size={17} />
              </button>
            </>
          )}
          <button
            className="icon-btn"
            title="Ajustes"
            onClick={() => setView(view === 'settings' ? 'main' : 'settings')}
          >
            <Gear size={19} />
          </button>
        </div>
      </header>

      <main className="content">
        {!snapshot ? (
          <p className="empty">Lendo o Claude Code…</p>
        ) : view === 'main' ? (
          <MainView />
        ) : view === 'sessions' ? (
          <SessionsView />
        ) : view === 'add' ? (
          <AddAccountView />
        ) : view === 'switch' ? (
          <SwitchView />
        ) : (
          <SettingsView />
        )}
      </main>

      {toast && <div className={`toast ${toast.ok ? '' : 'bad'}`}>{toast.message}</div>}
    </div>
  )
}

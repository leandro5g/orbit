import { Notification } from 'electron'
import { STATE_LABEL } from '../shared/format.ts'
import type { AccountView, SessionState, Settings } from '../shared/types.ts'
import type { LocalStore } from './db.ts'

/** Dispara alertas de uso e de sessão. O que já foi avisado fica no SQLite para não repetir após reiniciar. */
export class Notifier {
  private lastStates = new Map<string, SessionState>()
  private primed = false

  constructor(private store: LocalStore) {}

  private notify(title: string, body: string): void {
    if (Notification.isSupported()) new Notification({ title, body, silent: false }).show()
  }

  /** Marca a chave e devolve true só na primeira vez. */
  private once(key: string): boolean {
    if (this.store.get(key, false)) return false
    this.store.set(key, true)
    return true
  }

  run(accounts: AccountView[], s: Settings, now: number): void {
    for (const a of accounts) {
      if (s.alertsEnabled) this.usageAlerts(a, s, now)
      this.sessionAlerts(a, s)
    }
    this.primed = true
  }

  private usageAlerts(a: AccountView, s: Settings, now: number): void {
    const { fiveHour, sevenDay, forecast } = a.usage
    const windows = [
      { w: fiveHour, label: 'janela de 5h', tag: '5h' },
      { w: sevenDay, label: 'uso semanal', tag: '7d' }
    ]
    for (const { w, label, tag } of windows) {
      if (!w || w.usedPercent === null || w.resetsAt === null) continue
      const hit = [...s.thresholds].sort((x, y) => y - x).find((t) => w.usedPercent! >= t)
      if (hit !== undefined && this.once(`alert:${a.id}:${tag}:${w.resetsAt}:${hit}`))
        this.notify(`${a.name}: ${w.usedPercent}% da ${label}`, `Passou de ${hit}%. Renova às ${time(w.resetsAt)}.`)
    }

    if (s.notifyExhaustion && fiveHour?.resetsAt && forecast?.beforeReset && forecast.exhaustAt && forecast.confidence !== 'baixa') {
      const left = forecast.exhaustAt - now
      if (left > 0 && left < 45 * 60_000 && this.once(`alert:${a.id}:exhaust:${fiveHour.resetsAt}`))
        this.notify(
          `${a.name}: limite próximo do fim`,
          `No ritmo atual (estimativa), a janela de 5h esgota por volta de ${time(forecast.exhaustAt)}, antes do reset às ${time(fiveHour.resetsAt)}.`
        )
    }

    if (s.notifyReset && fiveHour?.renewed && fiveHour.resetsAt && now - fiveHour.resetsAt < 6 * 3600_000 && this.once(`alert:${a.id}:renewed:${fiveHour.resetsAt}`))
      this.notify(`${a.name}: janela de 5h renovada`, 'O limite de 5 horas foi renovado.')
  }

  private sessionAlerts(a: AccountView, s: Settings): void {
    for (const ses of a.sessions) {
      const prev = this.lastStates.get(ses.id)
      this.lastStates.set(ses.id, ses.state)
      if (!this.primed || prev === ses.state) continue
      const where = `${a.name} · ${ses.project}`
      if (ses.state === 'approval' && s.notifyApproval)
        this.notify(`${where}: aguardando aprovação`, ses.tool ? `Permissão para ${ses.tool}.` : ses.title)
      else if (ses.state === 'error' && s.notifyError) this.notify(`${where}: erro`, ses.title)
      else if (ses.state === 'completed' && s.notifyCompletion && prev && prev !== 'idle')
        this.notify(`${where}: ${STATE_LABEL.completed.toLowerCase()}`, ses.title)
    }
  }
}

function time(ts: number): string {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

import { create } from 'zustand'
import type { Snapshot } from '../../shared/types'

export type View = 'main' | 'sessions' | 'settings' | 'add' | 'switch'

interface UiState {
  snapshot: Snapshot | null
  view: View
  now: number
  toast: { ok: boolean; message: string } | null
  /** Conta de origem na tela "Trocar de conta". */
  switchFrom: string | null
  /** Trabalho que abriu a tela de troca (vem marcado; os outros da conta, não). */
  switchWork: string | null
  openSwitch: (from: string | null, work?: string | null) => void
  setSnapshot: (s: Snapshot) => void
  setView: (v: View) => void
  tick: () => void
  showToast: (t: { ok: boolean; message: string }) => void
}

let toastTimer: ReturnType<typeof setTimeout> | undefined

export const useOrbit = create<UiState>((set) => ({
  snapshot: null,
  view: 'main',
  now: Date.now(),
  toast: null,
  switchFrom: null,
  switchWork: null,
  openSwitch: (switchFrom, switchWork = null) => set({ switchFrom, switchWork, view: 'switch' }),
  setSnapshot: (snapshot) => set({ snapshot }),
  setView: (view) => set({ view }),
  tick: () => set({ now: Date.now() }),
  showToast: (toast) => {
    clearTimeout(toastTimer)
    set({ toast })
    toastTimer = setTimeout(() => set({ toast: null }), 6000)
  }
}))

export const selectedAccount = (s: UiState) => s.snapshot?.accounts.find((a) => a.id === s.snapshot?.selectedId) ?? null

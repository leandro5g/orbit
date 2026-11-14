import { create } from 'zustand'
import type { Snapshot } from '../../shared/types'

export type View = 'main' | 'sessions' | 'settings' | 'add'

interface UiState {
  snapshot: Snapshot | null
  view: View
  now: number
  toast: { ok: boolean; message: string } | null
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

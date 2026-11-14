import { createContext, useContext, type ReactNode } from "react";
import type { Snapshot } from "../../../src/shared/types";

/**
 * Substitui ../src/renderer/src/store.ts no vídeo (ver remotion.config.ts): mesma API, mas o estado vem
 * do frame atual, por contexto, em vez do Electron.
 */

export type View = "main" | "sessions" | "settings" | "add";

type UiState = {
  snapshot: Snapshot | null;
  view: View;
  now: number;
  toast: { ok: boolean; message: string } | null;
  setSnapshot: (s: Snapshot) => void;
  setView: (v: View) => void;
  tick: () => void;
  showToast: (t: { ok: boolean; message: string }) => void;
};

const noop = () => {};
const Ctx = createContext<UiState>({
  snapshot: null,
  view: "main",
  now: 0,
  toast: null,
  setSnapshot: noop,
  setView: noop,
  tick: noop,
  showToast: noop,
});

let current: UiState | null = null;

export function useOrbit(): UiState;
export function useOrbit<T>(selector: (s: UiState) => T): T;
export function useOrbit<T>(selector?: (s: UiState) => T) {
  const s = useContext(Ctx);
  return selector ? selector(s) : s;
}
useOrbit.getState = () => current!;

export const selectedAccount = (s: UiState) =>
  s.snapshot?.accounts.find((a) => a.id === s.snapshot?.selectedId) ?? null;

export const OrbitState = ({
  snapshot,
  view,
  now,
  children,
}: {
  snapshot: Snapshot;
  view: View;
  now: number;
  children: ReactNode;
}) => {
  const value: UiState = { snapshot, view, now, toast: null, setSnapshot: noop, setView: noop, tick: noop, showToast: noop };
  current = value;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

// Os componentes chamam window.orbit nos eventos e no App; no vídeo nada disso faz efeito.
const api = new Proxy(
  {},
  {
    get: (_t, key) =>
      key === "getSnapshot"
        ? () => new Promise(() => {})
        : key === "onSnapshot" || key === "onShown"
          ? () => noop
          : () => Promise.resolve(),
  },
);
(globalThis as unknown as { orbit: unknown }).orbit = api;

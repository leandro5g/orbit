import { demoSnapshot } from "../../../src/main/demo";
import type { SessionState, Settings, Snapshot } from "../../../src/shared/types";

/** Início fixo do "relógio" do vídeo: 13:30 de uma sexta. */
export const T0 = new Date(2026, 10, 13, 13, 30, 0).getTime();

const SETTINGS: Settings = {
  alertsEnabled: true,
  thresholds: [70, 85, 95],
  notifyExhaustion: true,
  notifyReset: true,
  notifyApproval: true,
  notifyCompletion: false,
  notifyError: true,
  openAtLogin: false,
  names: {},
  hiddenAccounts: [],
  extraConfigDirs: [],
  selectedAccountId: null,
  claudePath: "/usr/local/bin/claude",
  integrationHintDismissed: true,
  handoffEnabled: true,
  handoffAt: 90,
  switchAlertAt: 95,
  handoffFullHistory: false,
};

export type Params = {
  now: number;
  fiveHour: number;
  weekly: number;
  states?: Partial<Record<"a1" | "a2" | "b1", SessionState>>;
  tool?: Partial<Record<"a1" | "a2" | "b1", string | null>>;
};

/** Snapshot do modo demo do app, com uso e estados do momento do vídeo. */
export function snapshotAt(p: Params): Snapshot {
  const s = demoSnapshot(SETTINGS, T0);
  s.generatedAt = p.now;
  const personal = s.accounts[0];
  personal.usage.fiveHour!.usedPercent = Math.round(p.fiveHour);
  personal.usage.sevenDay!.usedPercent = Math.round(p.weekly);
  personal.usage.observedAt = p.now - 20_000;
  personal.alert = p.fiveHour >= 70;
  for (const acc of s.accounts) {
    for (const ses of acc.sessions) {
      const k = ses.id as "a1" | "a2" | "b1";
      const st = p.states?.[k];
      if (st) {
        ses.state = st;
        ses.stateSince = p.now - 40_000;
        ses.updatedAt = p.now - 5_000;
      }
      if (p.tool && k in p.tool) ses.tool = p.tool[k] ?? null;
    }
    const order: SessionState[] = ["error", "approval", "working", "thinking", "waiting", "completed", "idle"];
    acc.state = acc.sessions.map((x) => x.state).sort((a, b) => order.indexOf(a) - order.indexOf(b))[0] ?? "idle";
  }
  return s;
}

/** v2: estado do momento para o vídeo de Trabalhos e troca de conta. */
export type V2Params = {
  now: number;
  fiveHour: number;
  /** Registro do trabalho principal: pedido ao Claude ou já escrito por ele. */
  note: "requested" | "claude";
};

export function snapshotV2At(p: V2Params): Snapshot {
  const s = demoSnapshot(SETTINGS, T0);
  s.generatedAt = p.now;
  const personal = s.accounts[0];
  personal.usage.fiveHour!.usedPercent = Math.round(p.fiveHour);
  personal.usage.observedAt = p.now - 20_000;
  personal.alert = p.fiveHour >= 70;
  for (const w of s.works) {
    w.updatedAt = p.now - 20_000;
    if (w.noteAt) w.noteAt = p.now - (w.status === "paused" ? 3 * 3600_000 : 4 * 60_000);
    if (w.requestedAt) w.requestedAt = p.now - 3 * 60_000;
  }
  const main = s.works.find((w) => w.id === "a1")!;
  if (p.note === "requested") {
    Object.assign(main, { noteBy: "orbit", requestedAt: p.now - 40_000, doneItems: null, totalItems: null, next: null, noteAt: p.now - 40_000 });
  } else {
    main.noteAt = p.now - 15_000;
  }
  return s;
}

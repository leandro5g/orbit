import { Audio } from "@remotion/media";
import type { CSSProperties, ReactNode } from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import "../../src/renderer/src/styles.css";
import { App } from "../../src/renderer/src/App";
import { Sparkle } from "../../src/renderer/src/icons";
import { formatRemaining, STATE_LABEL, STATE_TONE } from "../../src/shared/format";
import type { Snapshot } from "../../src/shared/types";
import { snapshotAt, T0, type Params } from "./orbit/data";
import { OrbitState, type View } from "./orbit/store";

export type OrbitVideoProps = { music: string };

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const out = Easing.bezier(0.16, 1, 0.3, 1);
const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', system-ui, sans-serif";
const PURPLE = "#a78bfa";

/** Marcos do roteiro, em segundos. */
const T = {
  demo: 3,
  popover: 7.5,
  forecast: 13,
  sessions: 17,
  alert: 23.5,
  outro: 28,
  end: 32,
};

// ---------- estado do app a cada instante ----------

function paramsAt(sec: number): Params {
  const now = T0 + Math.max(0, sec - T.demo) * 30 * 4000; // 1 frame = 4 s no relógio do app
  const fiveHour =
    sec < T.alert
      ? interpolate(sec, [T.demo, T.forecast], [58, 72], { ...clamp, easing: Easing.inOut(Easing.quad) })
      : interpolate(sec, [T.alert, T.alert + 1.5], [72, 85], { ...clamp, easing: out });
  const weekly = interpolate(sec, [T.demo, T.forecast], [36, 41], clamp);
  const s = sec - T.sessions;
  return {
    now,
    fiveHour,
    weekly,
    states: {
      a1: s < 4.2 ? "working" : "completed",
      a2: s < 2 ? "approval" : "working",
      b1: s < 2.8 ? "waiting" : "thinking",
    },
    tool: { a1: s < 4.2 ? "Edit" : null, a2: s < 2 ? "Bash" : "Write" },
  };
}

function trayText(s: Snapshot): { dot: string; text: string } {
  const acc = s.accounts.find((a) => a.id === s.selectedId)!;
  const tone = STATE_TONE[acc.state];
  const dot = { green: "#4ade80", yellow: "#f5b83d", red: "#f87171", gray: "#8b8a9b" }[tone];
  const w = acc.usage.fiveHour!;
  return { dot, text: `${STATE_LABEL[acc.state]} | ${w.usedPercent}% · ${formatRemaining(w.resetsAt! - s.generatedAt)}` };
}

// ---------- peças ----------

const Background = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const r = Math.max(width, height);
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 70% 20%, #2b1d55 0%, #140f2a 45%, #08070f 100%)`,
        overflow: "hidden",
      }}
    >
      <svg width={width} height={height} style={{ position: "absolute", inset: 0, opacity: 0.55 }}>
        {[0.55, 0.8, 1.05].map((k, i) => (
          <ellipse
            key={k}
            cx={width * 0.62}
            cy={height * 0.55}
            rx={r * k * 0.5}
            ry={r * k * 0.18}
            fill="none"
            stroke={PURPLE}
            strokeOpacity={0.18 - i * 0.04}
            strokeWidth={2}
            transform={`rotate(${-18 + frame * 0.04 * (i % 2 ? -1 : 1)} ${width * 0.62} ${height * 0.55})`}
          />
        ))}
        {Array.from({ length: 70 }, (_, i) => {
          const x = (i * 7919) % width;
          const y = (i * 104729) % height;
          const tw = 0.25 + 0.35 * Math.abs(Math.sin(frame / 25 + i));
          return <circle key={i} cx={x} cy={y} r={i % 9 === 0 ? 1.8 : 1} fill="#fff" opacity={tw} />;
        })}
      </svg>
    </AbsoluteFill>
  );
};

const MenuBar = ({ snapshot, active }: { snapshot: Snapshot; active: boolean }) => {
  const { width } = useVideoConfig();
  const { dot, text } = trayText(snapshot);
  const clock = new Date(snapshot.generatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const scale = width / 1920;
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 44 * scale,
        background: "rgba(20, 16, 36, 0.72)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: `0 ${28 * scale}px`,
        color: "#f4f3fa",
        fontFamily: FONT,
        fontSize: 22 * scale,
        fontWeight: 500,
      }}
    >
      <div style={{ display: "flex", gap: 30 * scale, alignItems: "center" }}>
        <span style={{ fontSize: 26 * scale }}></span>
        <b>Terminal</b>
        <span style={{ opacity: 0.85 }}>Shell</span>
        <span style={{ opacity: 0.85 }}>Editar</span>
        <span style={{ opacity: 0.85 }}>Janela</span>
      </div>
      <div style={{ display: "flex", gap: 26 * scale, alignItems: "center" }}>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10 * scale,
            padding: `${4 * scale}px ${12 * scale}px`,
            borderRadius: 8 * scale,
            background: active ? "rgba(255,255,255,0.18)" : "transparent",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <Sparkle size={22 * scale} />
          <span style={{ width: 14 * scale, height: 14 * scale, borderRadius: 99, background: dot, display: "inline-block" }} />
          {text}
        </span>
        <span style={{ opacity: 0.85 }}>100%</span>
        <span style={{ opacity: 0.85, fontVariantNumeric: "tabular-nums" }}>sex 13 nov {clock}</span>
      </div>
    </div>
  );
};

/** O popover real do app (App.tsx), no estado do instante. */
const Popover = ({
  snapshot,
  view,
  style,
  children,
}: {
  snapshot: Snapshot;
  view: View;
  style?: CSSProperties;
  children?: ReactNode;
}) => (
  <div style={{ width: 392, position: "absolute", transformOrigin: "top right", ...style }}>
    <OrbitState snapshot={snapshot} view={view} now={snapshot.generatedAt}>
      <App />
    </OrbitState>
    {children}
  </div>
);

/** Contorno pulsando sobre a linha de previsão do popover (coordenadas do painel). */
const ForecastGlow = ({ from, to }: { from: number; to: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = frame / fps;
  const opacity =
    interpolate(sec, [from, from + 0.4, to - 0.4, to], [0, 1, 1, 0], clamp) * (0.65 + 0.35 * Math.sin(sec * 5));
  if (opacity <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: 438,
        left: 20,
        width: 348,
        height: 62,
        borderRadius: 12,
        border: "2px solid #f5b83d",
        boxShadow: "0 0 24px rgba(245,184,61,0.6)",
        opacity,
      }}
    />
  );
};

const Caption = ({ from, to, kicker, title }: { from: number; to: number; kicker: string; title: ReactNode }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const square = width / height < 1.3;
  const sec = frame / fps;
  const opacity = interpolate(sec, [from, from + 0.5, to - 0.4, to], [0, 1, 1, 0], clamp);
  const y = interpolate(sec, [from, from + 0.7], [40, 0], { ...clamp, easing: out });
  if (opacity <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        fontFamily: FONT,
        color: "#f4f3fa",
        opacity,
        translate: `0 ${y}px`,
        ...(square
          ? { left: 70, right: 70, top: 92, textAlign: "center" }
          : { left: 150, width: 820, top: "50%", marginTop: -170 }),
      }}
    >
      <div style={{ color: PURPLE, fontSize: square ? 30 : 34, fontWeight: 600, letterSpacing: 1, marginBottom: 18 }}>
        {kicker}
      </div>
      <div style={{ fontSize: square ? 58 : 84, fontWeight: 700, lineHeight: 1.08, letterSpacing: -1.5 }}>{title}</div>
    </div>
  );
};

const Notification = ({ start }: { start: number }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const square = width / height < 1.3;
  const sec = frame / fps;
  const x = interpolate(sec, [start, start + 0.6], [square ? 0 : 160, 0], { ...clamp, easing: out });
  const y = interpolate(sec, [start, start + 0.6], [square ? 160 : 0, 0], { ...clamp, easing: out });
  const opacity = interpolate(sec, [start, start + 0.3], [0, 1], clamp);
  if (sec < start) return null;
  return (
    <div
      style={{
        position: "absolute",
        // Ao lado do popover (16:9) ou abaixo dele (1:1), para não cobrir o uso.
        ...(square ? { bottom: 40, left: (width - 600) / 2 } : { top: 640, left: 150 }),
        width: 600,
        opacity,
        translate: `${x}px ${y}px`,
        display: "flex",
        gap: 16,
        padding: "16px 18px",
        borderRadius: 22,
        background: "rgba(48, 44, 64, 0.92)",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 18px 50px rgba(0,0,0,0.5)",
        fontFamily: FONT,
        color: "#f4f3fa",
      }}
    >
      <Img src={staticFile("icon.png")} style={{ width: 60, height: 60, borderRadius: 14 }} />
      <div style={{ fontSize: 22, lineHeight: 1.35, flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <b>Orbit</b>
          <span style={{ opacity: 0.6, fontSize: 16 }}>agora</span>
        </div>
        <div style={{ fontWeight: 600 }}>Pessoal chegou a 85% da janela de 5h</div>
        <div style={{ opacity: 0.8 }}>Esgota por volta de 14:34, antes do reset.</div>
      </div>
    </div>
  );
};

// ---------- cenas ----------

const Intro = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = frame / fps;
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
        color: "#f4f3fa",
        opacity: interpolate(sec, [T.demo - 0.5, T.demo], [1, 0], clamp),
      }}
    >
      <Img
        src={staticFile("icon.png")}
        style={{
          width: 260,
          height: 260,
          scale: interpolate(sec, [0, 1], [0.6, 1], { ...clamp, easing: Easing.spring({ damping: 12 }), output: "perceptual-scale" }),
          opacity: interpolate(sec, [0, 0.4], [0, 1], clamp),
          rotate: `${interpolate(sec, [0, 1.2], [-25, 0], { ...clamp, easing: out })}deg`,
        }}
      />
      <div
        style={{
          fontSize: 120,
          fontWeight: 800,
          letterSpacing: -3,
          marginTop: 20,
          opacity: interpolate(sec, [0.5, 1.1], [0, 1], clamp),
          translate: `0 ${interpolate(sec, [0.5, 1.2], [30, 0], { ...clamp, easing: out })}px`,
        }}
      >
        Orbit
      </div>
      <div
        style={{
          fontSize: 40,
          color: "#c9c5e0",
          textAlign: "center",
          padding: "0 60px",
          opacity: interpolate(sec, [1.1, 1.7], [0, 1], clamp),
        }}
      >
        Seus limites do Claude Code, sempre à vista
      </div>
    </AbsoluteFill>
  );
};

const Demo = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const square = width / height < 1.3;
  const sec = frame / fps;
  const snap = snapshotAt(paramsAt(sec));

  const enter = interpolate(sec, [T.demo, T.demo + 0.6], [0, 1], { ...clamp, easing: out });
  const leave = interpolate(sec, [T.outro - 0.5, T.outro], [1, 0], clamp);
  const open = interpolate(sec, [T.popover, T.popover + 0.55], [0, 1], { ...clamp, easing: out });
  const toSessions = interpolate(sec, [T.sessions, T.sessions + 0.35], [0, 1], clamp);
  const backMain = interpolate(sec, [T.alert - 0.4, T.alert], [0, 1], clamp);
  const sessionsOpacity = toSessions * (1 - backMain);

  const scale = square ? 1.12 : 1.5;
  const pop: CSSProperties = square
    ? { left: (width - 392 * scale) / 2, top: 300, transformOrigin: "top center" }
    : { right: 150, top: 52 };
  const popStyle = (o: number): CSSProperties => ({
    ...pop,
    scale: scale * (0.92 + 0.08 * open),
    opacity: open * o,
    translate: `0 ${(1 - open) * -30}px`,
  });

  return (
    <AbsoluteFill style={{ opacity: enter * leave }}>
      <MenuBar snapshot={snap} active={sec >= T.popover} />
      {sec >= T.popover && (
        <>
          <Popover snapshot={snap} view="main" style={popStyle(1 - sessionsOpacity)}>
            <ForecastGlow from={T.forecast + 0.3} to={T.sessions} />
          </Popover>
          {sessionsOpacity > 0 && <Popover snapshot={snap} view="sessions" style={popStyle(sessionsOpacity)} />}
        </>
      )}
      <Notification start={T.alert + 1.2} />
      <Caption from={T.demo + 0.3} to={T.popover} kicker="NA BARRA DE MENUS" title="Uso e tempo até o reset, sempre visíveis" />
      <Caption from={T.popover + 0.2} to={T.forecast} kicker="POR CONTA" title="Limites de 5 horas e semanal, ao vivo" />
      <Caption from={T.forecast} to={T.sessions} kicker="PREVISÃO" title="Saiba quando vai esgotar, antes do reset" />
      <Caption from={T.sessions} to={T.alert} kicker="SESSÕES" title="Todas as contas e sessões do Claude Code" />
      <Caption from={T.alert} to={T.outro} kicker="ALERTAS" title="Avisa antes de você ficar sem limite" />
    </AbsoluteFill>
  );
};

const Outro = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = frame / fps;
  const a = (from: number) => ({
    opacity: interpolate(sec, [from, from + 0.5], [0, 1], clamp),
    translate: `0 ${interpolate(sec, [from, from + 0.6], [24, 0], { ...clamp, easing: out })}px`,
  });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", fontFamily: FONT, color: "#f4f3fa", textAlign: "center" }}>
      <Img src={staticFile("icon.png")} style={{ width: 200, height: 200, ...a(0) }} />
      <div style={{ fontSize: 96, fontWeight: 800, letterSpacing: -3, marginTop: 10, ...a(0.2) }}>Orbit</div>
      <div style={{ fontSize: 40, color: "#c9c5e0", ...a(0.5) }}>Grátis e open source · macOS · Windows · Linux</div>
      <div
        style={{
          marginTop: 44,
          fontSize: 38,
          fontWeight: 600,
          padding: "18px 36px",
          borderRadius: 999,
          background: "rgba(167,139,250,0.16)",
          border: `2px solid ${PURPLE}`,
          ...a(0.9),
        }}
      >
        github.com/leandro5g/orbit
      </div>
    </AbsoluteFill>
  );
};

export const OrbitVideo = ({ music }: OrbitVideoProps) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "#08070f" }}>
      <Background />
      <Sequence name="Intro" durationInFrames={T.demo * fps}>
        <Intro />
      </Sequence>
      <Sequence name="Demo" durationInFrames={T.outro * fps}>
        <Demo />
      </Sequence>
      <Sequence name="Outro" from={T.outro * fps}>
        <Outro />
      </Sequence>
      <Audio
        src={staticFile(music)}
        volume={(f) => interpolate(f, [0, fps, (T.end - 2) * fps, T.end * fps], [0, 0.8, 0.8, 0], clamp)}
      />
    </AbsoluteFill>
  );
};

export const DURATION_SECONDS = T.end;

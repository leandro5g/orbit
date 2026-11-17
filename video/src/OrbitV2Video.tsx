import { Audio } from "@remotion/media";
import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import "../../src/renderer/src/styles.css";
import { demoNote } from "../../src/main/demo";
import { Background, Caption, MenuBar, Popover } from "./OrbitVideo";
import { snapshotV2At, T0 } from "./orbit/data";
import type { View } from "./orbit/store";

export type OrbitV2Props = { music: string };

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const out = Easing.bezier(0.16, 1, 0.3, 1);
const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', system-ui, sans-serif";
const MONO = "ui-monospace, 'SF Mono', Menlo, monospace";
const PURPLE = "#a78bfa";

/** Roteiro, em segundos. */
const T = {
  problem: 3,
  save: 9,
  note: 12.5,
  alert: 16.5,
  switch: 21.5,
  click: 25.2,
  resume: 26.5,
  outro: 31.5,
  end: 35,
};

const fade = (sec: number, a: number, b: number, d = 0.4) => interpolate(sec, [a, a + d, b - d, b], [0, 1, 1, 0], clamp);

function stateAt(sec: number) {
  const now = T0 + Math.max(0, sec - T.problem) * 60_000; // 1 s de vídeo = 1 min no relógio do app
  const fiveHour =
    sec < T.save
      ? interpolate(sec, [T.problem, T.save], [78, 89], { ...clamp, easing: Easing.inOut(Easing.quad) })
      : sec < T.alert
        ? interpolate(sec, [T.save, T.alert], [90, 93], clamp)
        : interpolate(sec, [T.alert, T.alert + 1.2], [93, 96], { ...clamp, easing: out });
  return snapshotV2At({ now, fiveHour, note: sec < T.save + 2.2 ? "requested" : "claude" });
}

/** Estilos dirigidos pelo frame: destaque na faixa de aviso e "clique" no botão da troca. */
const Highlights = ({ sec }: { sec: number }) => {
  const pulse = 0.5 + 0.5 * Math.sin(sec * 6);
  const banner = sec > T.alert + 0.8 && sec < T.switch ? pulse : 0;
  const glow = sec > T.switch + 1.2 && sec < T.resume ? pulse : 0;
  const press = interpolate(sec, [T.click, T.click + 0.12, T.click + 0.3], [1, 0.94, 1], clamp);
  return (
    <style>{`
      .switch-banner { box-shadow: 0 0 ${18 * banner}px rgba(245,184,61,${0.7 * banner}); }
      .btn.primary.wide { box-shadow: 0 0 ${26 * glow}px rgba(139,92,246,${0.9 * glow}); transform: scale(${press}); }
    `}</style>
  );
};

/** Registro de continuação, como o Claude escreve: aparece linha a linha. */
const NoteCard = ({ from, to, style }: { from: number; to: number; style: CSSProperties }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = frame / fps;
  const opacity = fade(sec, from, to);
  if (opacity <= 0) return null;
  const lines = demoNote.trim().split("\n");
  const shown = Math.floor(interpolate(sec, [from + 0.3, from + 2.2], [0, lines.length], clamp));
  return (
    <div
      style={{
        position: "absolute",
        opacity,
        translate: `0 ${interpolate(sec, [from, from + 0.6], [30, 0], { ...clamp, easing: out })}px`,
        padding: "26px 32px",
        borderRadius: 22,
        background: "rgba(20, 17, 34, 0.94)",
        border: "1px solid rgba(167,139,250,0.35)",
        boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
        fontFamily: MONO,
        color: "#e9e6f7",
        ...style,
      }}
    >
      <div style={{ fontFamily: FONT, color: PURPLE, fontSize: 20, fontWeight: 600, marginBottom: 14, letterSpacing: 1 }}>
        .orbit/trabalhos/a1.md · escrito pelo Claude
      </div>
      {lines.slice(0, shown).map((l, i) => {
        const h1 = l.startsWith("# ");
        const h2 = l.startsWith("## ");
        const done = /- \[x\]/.test(l);
        const todo = /- \[ \]/.test(l);
        return (
          <div
            key={i}
            style={{
              fontSize: h1 ? 26 : 20,
              lineHeight: 1.45,
              minHeight: l ? undefined : 8,
              fontWeight: h1 || h2 ? 700 : 400,
              color: h2 ? PURPLE : done ? "#4ade80" : todo ? "#f5b83d" : undefined,
            }}
          >
            {l.replace(/^#+ /, "").replace("- [x]", "✓").replace("- [ ]", "☐")}
          </div>
        );
      })}
    </div>
  );
};

const Notification = ({ start, end, style }: { start: number; end: number; style: CSSProperties }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const square = width / height < 1.3;
  const sec = frame / fps;
  const opacity = fade(sec, start, end, 0.3);
  if (opacity <= 0) return null;
  const k = interpolate(sec, [start, start + 0.6], [1, 0], { ...clamp, easing: out });
  return (
    <div
      style={{
        position: "absolute",
        width: 620,
        opacity,
        translate: square ? `0 ${160 * k}px` : `${160 * k}px 0`,
        display: "flex",
        gap: 16,
        padding: "16px 18px",
        borderRadius: 22,
        background: "rgba(48, 44, 64, 0.95)",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 18px 50px rgba(0,0,0,0.5)",
        fontFamily: FONT,
        color: "#f4f3fa",
        ...style,
      }}
    >
      <Img src={staticFile("icon.png")} style={{ width: 60, height: 60, borderRadius: 14 }} />
      <div style={{ fontSize: 22, lineHeight: 1.35, flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <b>Orbit</b>
          <span style={{ opacity: 0.6, fontSize: 16 }}>agora</span>
        </div>
        <div style={{ fontWeight: 600 }}>Pessoal em 96%: trocar de conta?</div>
        <div style={{ opacity: 0.8 }}>Os 2 trabalhos abertos estão salvos. Clique para escolher a conta.</div>
      </div>
    </div>
  );
};

/** Terminal genérico abrindo na conta nova e o Claude retomando a partir do registro. */
const TerminalScene = ({ from, style }: { from: number; style: CSSProperties }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = frame / fps;
  const opacity = interpolate(sec, [from, from + 0.4, T.outro - 0.4, T.outro], [0, 1, 1, 0], clamp);
  if (opacity <= 0) return null;
  const type = (text: string, a: number, b: number) => text.slice(0, Math.floor(interpolate(sec, [a, b], [0, text.length], clamp)));
  const prompt = "Continue o trabalho descrito em .orbit/trabalhos/a1.md";
  const reply = [
    "Retomando a previsão de esgotamento: 4 de 6 itens feitos.",
    "Falta: testes do forecast e a notificação antes do reset.",
    "Próximo passo: testes do forecast com janelas renovadas.",
  ];
  const line = (t: number) => interpolate(sec, [t, t + 0.3], [0, 1], clamp);
  return (
    <div
      style={{
        position: "absolute",
        opacity,
        scale: interpolate(sec, [from, from + 0.6], [0.94, 1], { ...clamp, easing: out }),
        borderRadius: 18,
        overflow: "hidden",
        background: "rgba(14, 12, 24, 0.97)",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
        fontFamily: MONO,
        color: "#e9e6f7",
        ...style,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", background: "rgba(255,255,255,0.05)" }}>
        {["#f87171", "#f5b83d", "#4ade80"].map((c) => (
          <span key={c} style={{ width: 14, height: 14, borderRadius: 99, background: c }} />
        ))}
        <span style={{ fontFamily: FONT, marginLeft: 12, opacity: 0.7, fontSize: 18 }}>orbit · conta Trabalho</span>
      </div>
      <div style={{ padding: "22px 28px", fontSize: 23, lineHeight: 1.55 }}>
        <div style={{ color: PURPLE, opacity: line(from + 0.2) }}>Orbit · continuando "Previsão de esgotamento" na conta Trabalho</div>
        <div style={{ marginTop: 14, opacity: line(from + 0.6) }}>
          <span style={{ color: "#4ade80" }}>❯ </span>
          {type(prompt, from + 0.6, from + 1.8)}
        </div>
        {reply.map((r, i) => (
          <div key={r} style={{ marginTop: i ? 2 : 14, opacity: line(from + 2.1 + i * 0.5), color: i === 2 ? "#fff" : "#c9c5e0" }}>
            {i === 0 ? "● " : "  "}
            {r}
          </div>
        ))}
      </div>
    </div>
  );
};

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
        textAlign: "center",
        opacity: interpolate(sec, [T.problem - 0.5, T.problem], [1, 0], clamp),
      }}
    >
      <Img
        src={staticFile("icon.png")}
        style={{
          width: 220,
          height: 220,
          scale: interpolate(sec, [0, 1], [0.6, 1], { ...clamp, easing: Easing.spring({ damping: 12 }), output: "perceptual-scale" }),
          opacity: interpolate(sec, [0, 0.4], [0, 1], clamp),
          rotate: `${interpolate(sec, [0, 1.2], [-25, 0], { ...clamp, easing: out })}deg`,
        }}
      />
      <div style={{ display: "flex", alignItems: "baseline", gap: 20, marginTop: 16, opacity: interpolate(sec, [0.5, 1.1], [0, 1], clamp) }}>
        <span style={{ fontSize: 112, fontWeight: 800, letterSpacing: -3 }}>Orbit</span>
        <span
          style={{
            fontSize: 44,
            fontWeight: 700,
            color: PURPLE,
            padding: "4px 18px",
            borderRadius: 999,
            border: `2px solid ${PURPLE}`,
            scale: interpolate(sec, [0.9, 1.3], [0.6, 1], { ...clamp, easing: Easing.spring({ damping: 10 }), output: "perceptual-scale" }),
          }}
        >
          v2
        </span>
      </div>
      <div style={{ fontSize: 42, color: "#c9c5e0", padding: "0 60px", opacity: interpolate(sec, [1.2, 1.8], [0, 1], clamp) }}>
        Troque de conta sem perder o contexto
      </div>
    </AbsoluteFill>
  );
};

const Demo = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const square = width / height < 1.3;
  const sec = frame / fps;
  const snap = stateAt(sec);

  // Qual tela do app aparece em cada trecho (com fade cruzado).
  const views: { view: View; from: number; to: number }[] = [
    { view: "main", from: T.problem, to: T.save },
    { view: "sessions", from: T.save, to: T.alert },
    { view: "main", from: T.alert, to: T.switch },
    { view: "switch", from: T.switch, to: T.resume },
  ];
  const enter = interpolate(sec, [T.problem, T.problem + 0.6], [0, 1], { ...clamp, easing: out });
  const leave = interpolate(sec, [T.outro - 0.5, T.outro], [1, 0], clamp);

  const scale = square ? 1.05 : 1.3;
  // No quadrado, o registro ocupa o lugar do popover enquanto aparece.
  const noteOverPopover = square ? 1 - fade(sec, T.note, T.alert) : 1;
  const pop = (o: number): CSSProperties => ({
    ...(square ? { left: (width - 392 * scale) / 2, top: 290, transformOrigin: "top center" } : { right: 150, top: 70 }),
    scale,
    opacity: o * noteOverPopover,
  });

  return (
    <AbsoluteFill style={{ opacity: enter * leave }}>
      <Highlights sec={sec} />
      <MenuBar snapshot={snap} active={sec < T.resume} />
      {sec < T.resume &&
        views.map((v, i) => {
          const o = interpolate(sec, [v.from - 0.35, v.from, v.to - 0.35, v.to], [i === 0 ? 1 : 0, 1, 1, 0], clamp);
          return o > 0 ? <Popover key={i} snapshot={snap} view={v.view} style={pop(o)} /> : null;
        })}

      <NoteCard
        from={T.note}
        to={T.alert}
        style={square ? { left: 90, right: 90, top: 300 } : { left: 150, width: 780, top: 150 }}
      />
      <Notification start={T.alert + 1.3} end={T.switch} style={square ? { bottom: 50, left: (width - 620) / 2 } : { top: 640, left: 150 }} />
      <TerminalScene
        from={T.resume}
        style={square ? { left: 70, right: 70, top: 330 } : { left: (width - 1180) / 2, width: 1180, top: 470 }}
      />

      <Caption from={T.problem + 0.3} to={T.save} kicker="O PROBLEMA" title="O limite acaba no meio da tarefa" />
      <Caption from={T.save} to={T.note} kicker="NOS 90%" title="O Orbit salva onde você parou" />
      {square && <Caption from={T.note} to={T.alert} kicker="REGISTRO DE CONTINUAÇÃO" title="Feito, falta e próximo passo" />}
      <Caption from={T.alert} to={T.switch} kicker="TOKENS TERMINANDO" title="Ele pergunta se você quer trocar" />
      <Caption from={T.switch} to={T.resume} kicker="UM CLIQUE" title="Escolha a conta e leve os trabalhos" />
      <ResumeCaption />
    </AbsoluteFill>
  );
};

/** Na retomada, a legenda fica em cima e centralizada também no 16:9 (o terminal ocupa a parte de baixo). */
const ResumeCaption = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const square = width / height < 1.3;
  const sec = frame / fps;
  const opacity = fade(sec, T.resume, T.outro);
  if (opacity <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: 70,
        right: 70,
        top: square ? 92 : 150,
        textAlign: "center",
        fontFamily: FONT,
        color: "#f4f3fa",
        opacity,
        translate: `0 ${interpolate(sec, [T.resume, T.resume + 0.7], [40, 0], { ...clamp, easing: out })}px`,
      }}
    >
      <div style={{ color: PURPLE, fontSize: square ? 30 : 34, fontWeight: 600, letterSpacing: 1, marginBottom: 18 }}>OUTRA CONTA</div>
      <div style={{ fontSize: square ? 58 : 84, fontWeight: 700, lineHeight: 1.08, letterSpacing: -1.5 }}>
        Mesmo contexto. O Claude continua de onde parou.
      </div>
    </div>
  );
};

const Outro = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = frame / fps;
  const a = (from: number): CSSProperties => ({
    opacity: interpolate(sec, [from, from + 0.5], [0, 1], clamp),
    translate: `0 ${interpolate(sec, [from, from + 0.6], [24, 0], { ...clamp, easing: out })}px`,
  });
  const Pill = ({ children, at }: { children: ReactNode; at: number }) => (
    <div
      style={{
        marginTop: 40,
        fontSize: 38,
        fontWeight: 600,
        padding: "18px 36px",
        borderRadius: 999,
        background: "rgba(167,139,250,0.16)",
        border: `2px solid ${PURPLE}`,
        ...a(at),
      }}
    >
      {children}
    </div>
  );
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", fontFamily: FONT, color: "#f4f3fa", textAlign: "center" }}>
      <Img src={staticFile("icon.png")} style={{ width: 180, height: 180, ...a(0) }} />
      <div style={{ fontSize: 92, fontWeight: 800, letterSpacing: -3, marginTop: 10, ...a(0.2) }}>Orbit v2</div>
      <div style={{ fontSize: 40, color: "#c9c5e0", padding: "0 60px", ...a(0.5) }}>
        Trabalhos salvos · troca de conta em um clique
      </div>
      <div style={{ fontSize: 34, color: "#9c9aae", marginTop: 10, ...a(0.7) }}>Grátis e open source · macOS · Windows · Linux</div>
      <Pill at={1}>github.com/leandro5g/orbit</Pill>
    </AbsoluteFill>
  );
};

export const OrbitV2Video = ({ music }: OrbitV2Props) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "#08070f" }}>
      <Background />
      <Sequence name="Intro" durationInFrames={T.problem * fps}>
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

export const V2_SECONDS = T.end;

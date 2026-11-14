# Vídeo de demonstração do Orbit

Feito com [Remotion](https://www.remotion.dev). O vídeo usa os componentes reais do popover
(`../src/renderer`) com os dados fictícios do modo demo (`../src/main/demo.ts`). A store do app é trocada
por uma store controlada pelo frame (`src/orbit/store.tsx`, ligada em `remotion.config.ts`).

```bash
npm install
npm run dev                                        # Studio: preview e ajustes
npx remotion render OrbitDemo out/orbit-demo.mp4   # 1920x1080
npx remotion render OrbitDemoSquare out/orbit-demo-square.mp4   # 1080x1080
```

O roteiro (tempos de cada cena) fica em `T`, no topo de `src/OrbitVideo.tsx`. Para trocar a música, mude a
prop `music` (Studio ou `src/Root.tsx`).

## Músicas (CC0, domínio público)

- `public/oldskool.mp3`: "Oldskool", de Of Far Different Nature. [OpenGameArt](https://opengameart.org/content/oldskool), CC0.
- `public/shineblitz.mp3`: "Shine Blitz". [OpenGameArt](https://opengameart.org/content/shine-blitz), CC0.

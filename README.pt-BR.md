<div align="center">

<img src="docs/img/icon.png" width="120" alt="Ícone do Orbit" />

# Orbit

### Seus limites do Claude Code, sempre à vista.

Chega de ser pego de surpresa pelo *"usage limit reached"*. O Orbit fica na barra de menus e mostra o
**uso de 5 horas e semanal**, a **contagem até o próximo reset**, **quando você vai esgotar** no ritmo atual
e **cada sessão aberta do Claude Code**, em todas as suas contas.

[![Baixar](https://img.shields.io/github/v/release/leandro5g/orbit?style=for-the-badge&color=8b5cf6&label=Baixar&logo=github)](https://github.com/leandro5g/orbit/releases/latest)

[![CI](https://img.shields.io/github/actions/workflow/status/leandro5g/orbit/ci.yml?branch=main&label=CI&style=flat-square)](https://github.com/leandro5g/orbit/actions/workflows/ci.yml)
![Plataformas](https://img.shields.io/badge/macOS%20·%20Windows%20·%20Linux-2b2540?style=flat-square&logo=electron)
[![Licença: MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-a78bfa?style=flat-square)](LICENSE)
![Tudo local](https://img.shields.io/badge/100%25-local-4ade80?style=flat-square)
[![Stars](https://img.shields.io/github/stars/leandro5g/orbit?style=flat-square&color=f5b83d)](https://github.com/leandro5g/orbit/stargazers)

[English](README.md) · **Português**

<a href="https://github.com/leandro5g/orbit/releases/download/v0.1.1/orbit-demo.mp4">
  <img src="docs/img/demo.gif" width="880" alt="Demonstração do Orbit: barra de menus, limites, previsão, sessões e alertas" />
</a>

<sub>▶ <a href="https://github.com/leandro5g/orbit/releases/download/v0.1.1/orbit-demo.mp4">Assistir em HD, com música</a></sub>

</div>

## 🚀 Instale com uma linha

**macOS / Linux**, cole no Terminal:

```bash
curl -fsSL https://raw.githubusercontent.com/leandro5g/orbit/main/install.sh | sh
```

**Windows**, cole no PowerShell:

```powershell
irm https://raw.githubusercontent.com/leandro5g/orbit/main/install.ps1 | iex
```

Pronto: baixa a última versão, instala e abre o Orbit. No macOS ele vai para **Aplicativos** (`/Applications`), como qualquer app; se precisar, pede a senha de administrador. Procure o ✦ na barra de menus.
Para atualizar, rode o mesmo comando de novo. Prefere clicar? [Baixe o instalador](#-instalar).

---

## ✨ O que ele faz

<table>
<tr>
<td width="50%" valign="top">

### ⏱ Limites num relance
Uso de 5h e semanal por conta, com contagem regressiva até cada reset, ao lado do relógio.
`🟢 Trabalhando | 72% · 1h 38m`

### 📈 Previsão de esgotamento
No ritmo atual, o Orbit diz **quando você chega a 100%** e se isso acontece **antes do reset**,
para você desacelerar, trocar de conta ou planejar uma pausa.

### 👥 Várias contas
Pessoal, trabalho, cliente… Cada pasta do Claude Code é encontrada sozinha. Conta nova em dois cliques.

### 🔁 Troque de conta sem perder o contexto
Nos 90% (configurável), o Orbit salva um **registro de continuação** de cada trabalho aberto: objetivo, feito,
falta, decisões e próximo passo. Quando os tokens acabam, você escolhe outra conta e o Claude continua de onde parou.

</td>
<td width="50%" valign="top">

### 🖥 Sessões ao vivo
Trabalhando, pensando, **esperando sua aprovação**, erro, concluída, e a ferramenta em uso e há quanto tempo.

### 🧩 Alterações de código
Linhas escritas pelo Claude na sessão e alterações não commitadas no repositório (git), por sessão.

### 🔔 Alertas inteligentes
Notificações nativas nos seus limiares (50/70/85/95%), na previsão de esgotamento, no reset,
quando uma sessão pede aprovação ou dá erro.

</td>
</tr>
</table>

<div align="center">
<img src="docs/img/main.png" width="340" alt="Popover do Orbit" />
&nbsp;&nbsp;&nbsp;
<img src="docs/img/sessions.png" width="340" alt="Tela de sessões do Orbit" />
</div>

## 📦 Instalar

Ou baixe o instalador em [**Releases**](https://github.com/leandro5g/orbit/releases/latest):

| Sistema | Arquivo |
| --- | --- |
| 🍎 macOS · Apple Silicon (M1–M4) | `Orbit-x.y.z-mac-arm64.dmg` |
| 🍎 macOS · Intel | `Orbit-x.y.z-mac-x64.dmg` |
| 🪟 Windows 10/11 | `Orbit-x.y.z-win-x64.exe` |
| 🐧 Linux | `Orbit-x.y.z-linux-x86_64.AppImage` |

> [!IMPORTANT]
> **macOS, só na instalação manual:** o Orbit ainda não é notarizado pela Apple (o comando de uma linha já resolve isso). Depois de arrastar para Aplicativos, rode uma vez:
> ```bash
> xattr -dr com.apple.quarantine /Applications/Orbit.app
> ```
> ou abra por **Ajustes do Sistema → Privacidade e Segurança → Abrir Mesmo Assim**.

**Requisito:** [Claude Code](https://docs.anthropic.com/en/docs/claude-code) instalado e com login feito. Só isso:
quem já usa o Claude Code não configura nada.

## 🔒 Privacidade e como funciona

**O Orbit nunca pede senha e nunca lê nem guarda tokens.** Tudo o que fala com a Anthropic passa pelo
binário oficial `claude`, com o seu login.

| O quê | Como |
| --- | --- |
| **Uso** | Roda `claude -p /usage` localmente a cada poucos minutos, **sem gastar tokens**. |
| **Contas** | Cada conta é uma pasta do Claude Code (`CLAUDE_CONFIG_DIR`). `~/.claude` e `~/.claude-*` são encontradas sozinhas. **+ → Nova conta** abre o Terminal para o login oficial. |
| **Detalhes das sessões** *(opcional)* | Um clique instala statusline e hooks (com backup do `settings.json`) para aprovação, erro, ferramenta em uso e uso em tempo real. |
| **Registro de continuação** | Fica em `<repo>/.orbit/trabalhos/` (fora do git). Perto do limite, o hook pede ao Claude, uma vez e no fim do turno, que escreva o registro. |
| **Seus dados** | Ficam na sua máquina, num SQLite local. Sem servidor, sem telemetria, sem analytics. |

Detalhes do que é lido e instalado: [docs/integracao.md](docs/integracao.md).

## ❓ Perguntas frequentes

<details>
<summary><b>Gasta tokens ou conta no meu limite?</b></summary>

Não. O `/usage` é um comando local do Claude Code que informa os limites sem mandar prompt para o modelo.
</details>

<details>
<summary><b>A Anthropic permite isso?</b></summary>

O Orbit não tem login próprio, não mexe nos seus tokens OAuth e não chama a API da Anthropic direto.
Ele só roda a CLI oficial do Claude Code por você, como você faria no terminal.
</details>

<details>
<summary><b>A previsão é precisa?</b></summary>

É uma estimativa móvel, baseada no seu ritmo recente na janela de 5h, com um nível de confiança
(baixa/média/alta) que cresce com o número de amostras. A interface marca como estimativa.
</details>

## 🗺 Próximos passos

- [ ] Interface em inglês (i18n)
- [ ] Build notarizado para macOS + Homebrew cask
- [ ] Gráficos do histórico de uso
- [ ] Ajustes para Windows/Linux (hooks em PowerShell, comportamento da bandeja)
- [ ] Atualização automática

## 🛠 Desenvolvimento

```bash
npm install
npm run dev          # desenvolvimento com hot reload
npm test             # testes (previsão, estados, parser, instalador)
npm run dist:mac     # ou dist:win / dist:linux → dist/
```

**Stack:** Electron · React · TypeScript · Vite · Zustand · SQLite (`node:sqlite`).

```
src/main/        processo principal: coleta e menu bar
  accounts.ts      descoberta das contas e identidade
  claude-cli.ts    acha o binário, roda /usage, abre o login no Terminal
  usage-text.ts    parser do texto do /usage
  usage.ts         leitura da statusline + amostras no SQLite
  forecast.ts      previsão de esgotamento
  sessions.ts      sessões abertas, pid, hooks
  state.ts         estado da sessão a partir de status + hook
  git.ts           alterações por repositório
  integration.ts   instalador da statusline e dos hooks
  notifications.ts alertas nativos
  demo.ts          dados fictícios (ORBIT_DEMO=1)
src/preload/     ponte IPC
src/renderer/    popover (React + Zustand)
src/shared/      tipos e formatação
video/           vídeo de demonstração (Remotion, com os componentes reais)
```

Variáveis úteis: `ORBIT_DEMO=1` (dados fictícios, para prints), `ORBIT_OPEN=1` (abre o popover ao iniciar),
`ORBIT_CAPTURE=/tmp/x.png` (grava um print do popover), `ORBIT_DEBUG=1` (loga as leituras do `/usage`).

**Publicar uma versão:** `npm version patch && git push --follow-tags`. O GitHub Actions gera os builds de
macOS, Windows e Linux e publica a release.

## 🤝 Contribuir

Issues e PRs são muito bem-vindos: veja o [CONTRIBUTING.md](CONTRIBUTING.md).
Se o Orbit te salvou de um limite surpresa, deixe uma ⭐: ajuda outras pessoas a encontrarem o projeto.

---

<div align="center">
<sub>
O Orbit é um projeto independente, sem vínculo com a Anthropic.
"Claude" e "Claude Code" são marcas da Anthropic.<br/>
<a href="LICENSE">MIT</a> © Leandro Moraes
</sub>
</div>

<div align="center">

<img src="docs/img/icon.png" width="120" alt="Orbit icon" />

# Orbit

### Your Claude Code limits, always in sight.

Stop getting surprised by *"usage limit reached"*. Orbit lives in your menu bar and shows your
**5-hour and weekly usage**, a **countdown to the next reset**, **when you'll run out** at your current pace
and **every live Claude Code session**, across all your accounts.

[![Download](https://img.shields.io/github/v/release/leandro5g/orbit?style=for-the-badge&color=8b5cf6&label=Download&logo=github)](https://github.com/leandro5g/orbit/releases/latest)

[![CI](https://img.shields.io/github/actions/workflow/status/leandro5g/orbit/ci.yml?branch=main&label=CI&style=flat-square)](https://github.com/leandro5g/orbit/actions/workflows/ci.yml)
![Platforms](https://img.shields.io/badge/macOS%20·%20Windows%20·%20Linux-2b2540?style=flat-square&logo=electron)
[![License: MIT](https://img.shields.io/badge/license-MIT-a78bfa?style=flat-square)](LICENSE)
![Local only](https://img.shields.io/badge/100%25-local-4ade80?style=flat-square)
[![Stars](https://img.shields.io/github/stars/leandro5g/orbit?style=flat-square&color=f5b83d)](https://github.com/leandro5g/orbit/stargazers)

**English** · [Português](README.pt-BR.md)

<a href="https://github.com/leandro5g/orbit/releases/download/v0.1.1/orbit-demo.mp4">
  <img src="docs/img/demo.gif" width="880" alt="Orbit demo: menu bar, limits, forecast, sessions and alerts" />
</a>

<sub>▶ <a href="https://github.com/leandro5g/orbit/releases/download/v0.1.1/orbit-demo.mp4">Watch in HD with music</a></sub>

</div>

---

## ✨ Features

<table>
<tr>
<td width="50%" valign="top">

### ⏱ Limits at a glance
5-hour and weekly usage per account, with a live countdown to each reset — right next to the clock.
`🟢 Working | 72% · 1h 38m`

### 📈 Exhaustion forecast
At your current pace, Orbit tells you **when you'll hit 100%** and whether it happens **before the reset** —
so you can slow down, switch accounts or plan a break.

### 👥 Multiple accounts
Personal, work, client… Every Claude Code config dir is picked up automatically. Add a new one in two clicks.

</td>
<td width="50%" valign="top">

### 🖥 Live sessions
Working, thinking, **waiting for your approval**, error, done — plus the tool in use and how long it's been running.

### 🧩 Code changes
Lines Claude wrote in the session and uncommitted changes in the repo (git), per session.

### 🔔 Smart alerts
Native notifications at your thresholds (50/70/85/95%), on predicted exhaustion, on reset,
when a session needs approval or fails.

</td>
</tr>
</table>

<div align="center">
<img src="docs/img/main.png" width="340" alt="Orbit popover" />
&nbsp;&nbsp;&nbsp;
<img src="docs/img/sessions.png" width="340" alt="Orbit sessions view" />
</div>

## 📦 Install

Grab the latest build from [**Releases**](https://github.com/leandro5g/orbit/releases/latest):

| System | File |
| --- | --- |
| 🍎 macOS · Apple Silicon (M1–M4) | `Orbit-x.y.z-mac-arm64.dmg` |
| 🍎 macOS · Intel | `Orbit-x.y.z-mac-x64.dmg` |
| 🪟 Windows 10/11 | `Orbit-x.y.z-win-x64.exe` |
| 🐧 Linux | `Orbit-x.y.z-linux-x86_64.AppImage` |

> [!IMPORTANT]
> **macOS:** Orbit isn't notarized by Apple yet. After dragging it to Applications, run once:
> ```bash
> xattr -dr com.apple.quarantine /Applications/Orbit.app
> ```
> or open it via **System Settings → Privacy & Security → Open Anyway**.

**Requirement:** [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed and logged in. That's it —
if you already use Claude Code, Orbit works on first launch with zero setup.

## 🔒 Privacy & how it works

**Orbit never asks for your password and never reads or stores tokens.** Everything that talks to Anthropic
goes through the official `claude` binary, with your own login.

| What | How |
| --- | --- |
| **Usage** | Runs `claude -p /usage` locally every few minutes — **no tokens spent**. |
| **Accounts** | Each account is a Claude Code config dir (`CLAUDE_CONFIG_DIR`). `~/.claude` and `~/.claude-*` are found automatically. **+ → New account** opens the Terminal for the official login. |
| **Session details** *(optional)* | One click installs a statusline and hooks (with a backup of your `settings.json`) for approval/error states, the tool in use and real-time usage. |
| **Your data** | Stays on your machine, in a local SQLite file. No server, no telemetry, no analytics. |

Full details on what is read and installed: [docs/integracao.md](docs/integracao.md).

## ❓ FAQ

<details>
<summary><b>Does it cost tokens or count against my limits?</b></summary>

No. `/usage` is a local Claude Code command that reports your limits without sending a prompt to the model.
</details>

<details>
<summary><b>Is this allowed by Anthropic?</b></summary>

Orbit doesn't implement its own login, doesn't touch your OAuth tokens and doesn't call Anthropic's API directly.
It only runs the official Claude Code CLI on your behalf, exactly like you would in a terminal.
</details>

<details>
<summary><b>How accurate is the forecast?</b></summary>

It's a moving estimate based on your recent usage rate in the 5-hour window, with a confidence level
(low/medium/high) that grows with the number of samples. It's labeled as an estimate in the UI.
</details>

<details>
<summary><b>Why is the UI in Portuguese?</b></summary>

Orbit started as a personal tool. English UI is on the roadmap — PRs welcome!
</details>

## 🗺 Roadmap

- [ ] English UI (i18n)
- [ ] Notarized macOS build + Homebrew cask
- [ ] Usage history charts
- [ ] Windows/Linux polish (hooks via PowerShell, tray behaviors)
- [ ] Auto-update

## 🛠 Development

```bash
npm install
npm run dev          # run with hot reload
npm test             # unit tests (forecast, states, parser, installer)
npm run dist:mac     # or dist:win / dist:linux → dist/
```

**Stack:** Electron · React · TypeScript · Vite · Zustand · SQLite (`node:sqlite`).

Useful env vars: `ORBIT_DEMO=1` (fake data, for screenshots), `ORBIT_OPEN=1` (open the popover on start),
`ORBIT_DEBUG=1` (log `/usage` reads).

The demo video is made with [Remotion](https://www.remotion.dev) using the app's real components — see [`video/`](video/).

**Releasing:** `npm version patch && git push --follow-tags` — GitHub Actions builds macOS, Windows and Linux
and publishes the release.

## 🤝 Contributing

Issues and PRs are very welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).
If Orbit saves you from a surprise rate limit, consider leaving a ⭐ — it helps others find it.

---

<div align="center">
<sub>
Orbit is an independent project, not affiliated with or endorsed by Anthropic.
"Claude" and "Claude Code" are trademarks of Anthropic.<br/>
<a href="LICENSE">MIT</a> © Leandro Moraes
</sub>
</div>

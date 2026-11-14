# Contributing to Orbit

Thanks for wanting to help! Orbit is small and friendly to first contributions.
*(Português: issues e PRs podem ser em português ou inglês.)*

## Getting started

```bash
git clone https://github.com/leandro5g/orbit.git
cd orbit
npm install
npm run dev
```

You need Node 24+ and, to see real data, [Claude Code](https://docs.anthropic.com/en/docs/claude-code) logged in.
No Claude Code? Run with fake data: `ORBIT_DEMO=1 npm run dev`.

## Before opening a PR

```bash
npm run typecheck
npm test
```

- Keep pure logic (parsing, forecast, state) in its own module with tests — see `src/main/*.test.ts`.
- Orbit must never handle credentials: anything that talks to Anthropic goes through the official `claude` binary.
- Nothing leaves the user's machine. No telemetry, no network calls besides the Claude Code CLI.
- Screenshots in PRs: please use `ORBIT_DEMO=1` so no personal data shows up.

## Good first issues

- English UI (i18n of the strings in `src/renderer` and notifications)
- Windows: hooks/statusline in PowerShell instead of `sh`
- Linux tray quirks on different desktop environments

## Reporting bugs

Use the [bug template](https://github.com/leandro5g/orbit/issues/new?template=bug.yml) and include your OS,
Orbit version and Claude Code version (`claude --version`).

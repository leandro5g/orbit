# Fontes de dados do Orbit

Investigado no Claude Code 2.1.325 (macOS), em 14/11/2026. Regra do PRD: nada de endpoint privado nem
autenticação não documentada. Quando não há dado confiável, o Orbit mostra "—" ou "indisponível".

| Métrica | Fonte | Confiável? |
|---|---|---|
| % da janela de 5h e semanal, com reset | **`claude -p /usage`** rodado pelo Orbit a cada 5 min (e ao abrir o popover) | Sim: é o binário oficial com o login do usuário. 0 tokens. Inclui uso do claude.ai |
| Mesmos limites em tempo real | `rate_limits.five_hour/seven_day` no JSON da **statusline** (opcional) | Sim. Só existe com sessão aberta |
| Modelo, nome da sessão, linhas escritas pelo Claude | `model`, `session_name`, `cost.total_lines_*` da statusline | Sim |
| Sessões abertas, pasta, status busy/idle | `<CLAUDE_CONFIG_DIR>/sessions/<pid>.json` (o Claude Code mantém enquanto a sessão está aberta) + checagem do pid | Sim. Arquivo interno, sem contrato público: pode mudar de formato |
| Aprovação, erro, ferramenta em uso, início do turno | **Hooks** (`PermissionRequest`, `Notification`, `StopFailure`, `PreToolUse`, `UserPromptSubmit`...) | Sim, mecanismo documentado |
| E-mail / organização da conta | `oauthAccount` em `.claude.json` (`~/.claude.json` para a conta padrão) | Sim. O Orbit lê só esse campo, nunca tokens |
| Alterações de código e branch | `git status --porcelain`, `git diff HEAD --numstat` no repositório da sessão | Sim. É o estado não commitado do repo, não só desta sessão |
| Previsão de esgotamento | Regressão linear local das leituras de 5h dos últimos 90 min | **Estimativa**, marcada como tal |

## Login e credenciais

O Orbit não faz login nem lê token. A Anthropic proíbe apps de terceiros de oferecer login de Claude.ai
ou guardar credenciais ([Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance)).
O login é sempre o do Claude Code: "Nova conta" cria `~/.claude-<nome>` e abre o Terminal com o Claude
Code nessa pasta, que pede o login no navegador.

O `/usage` roda com `--setting-sources "" --no-session-persistence --strict-mcp-config`: não dispara
hooks/plugins/MCP do usuário e não grava sessão. Precisa de stdin fechado e de `USER` no ambiente
(sem `USER` o Claude Code não acha o login no Keychain e responde como deslogado).

## Limitações conhecidas

- **O texto do `/usage` não é um formato estável.** Se mudar, o Orbit mostra "indisponível" e segue com a
  statusline. Os testes em `src/main/usage-text.test.ts` cobrem os formatos vistos.
- Entre uma leitura e outra (até 5 min), uso feito fora do Claude Code não aparece. O popover mostra
  "Uso lido do Claude Code há X".
- Depois que a janela passa do reset, o Orbit não sabe o uso novo até chegar outra leitura e mostra
  "renovada" em vez de supor 0%.
- O contexto (`context_window`) não é cota da conta e não é usado para isso.
- Sem os hooks, o estado vem só de busy/idle: não há "Aprovação" nem "Erro".
- Várias sessões no mesmo repositório compartilham a mesma contagem do git (calculada uma vez por repo).

## O que é instalado (opcional: "Ativar detalhes das sessões")

- `~/.orbit/statusline.sh`: grava o JSON da statusline em `~/.orbit/statusline/<conta>/<session_id>.json`.
  Não imprime nada. Se já existir outra statusline, ela **não** é substituída.
- `~/.orbit/hook.sh`: grava o último evento em `~/.orbit/events/<session_id>.json` (evento, ferramenta,
  tipo de notificação). Nunca o prompt. Sem saída e sempre `exit 0`.
- Entradas em `settings.json` da conta, com backup `settings.json.orbit-bak-<timestamp>`. Idempotente.

A conta é identificada por `CLAUDE_CONFIG_DIR` (`~/.claude` → `claude`, `~/.claude-work` → `claude-work`).

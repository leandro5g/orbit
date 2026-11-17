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
  tipo de notificação). Nunca o prompt. Sempre `exit 0`. Só imprime algo no caso do registro de continuação
  (abaixo). O Orbit atualiza o próprio script ao abrir quando a versão muda (`# orbit-hook: vN`).
- Permissão `Edit(.orbit/trabalhos/**)`: o Claude pode escrever o registro de continuação sem pedir aprovação.
- Entradas em `settings.json` da conta, com backup `settings.json.orbit-bak-<timestamp>`. Idempotente.

A conta é identificada por `CLAUDE_CONFIG_DIR` (`~/.claude` → `claude`, `~/.claude-work` → `claude-work`).

## Trabalhos e troca de conta sem perder contexto

Cada sessão do Claude Code vira um **trabalho** (o nome é o título que o Claude Code dá à conversa, no
histórico `<CLAUDE_CONFIG_DIR>/projects/<pasta>/<session_id>.jsonl`). O trabalho sobrevive à sessão e à conta.

1. **Nos `handoffAt`% (padrão 90%)** da janela de 5h ou da semana, para cada trabalho aberto na conta:
   - O Orbit escreve um rascunho em `<repo>/.orbit/trabalhos/<id>.md`, sem tokens: primeiro pedido, pedidos
     recentes, última resposta do Claude e arquivos alterados no git. `<repo>/.orbit/.gitignore` ignora tudo.
   - Com os hooks instalados, grava o pedido em `~/.orbit/handoff/<session_id>`. No próximo `Stop` (fim do
     turno), o `hook.sh` devolve `{"decision":"block","reason":...}` uma única vez e o Claude reescreve o
     registro com objetivo, feito/falta (checklist), decisões, arquivos e próximo passo. Com `stop_hook_active`
     o pedido não é repetido. Com a conta já em 100%, não há pedido ao Claude: fica o rascunho.
2. **Nos `switchAlertAt`% (padrão 95%) ou com a conta esgotada**: notificação "trocar de conta?" e um bloco
   no topo do popover ("Lab esgotou · volta às 17:40") com as sessões da conta, cada uma com o botão
   **Continuar em <conta com mais folga>**. Em **Sessões**, cada sessão tem **Continuar em outra conta**, que
   abre a tela de troca para escolher a conta.
3. **Continuar em outra conta** abre o Terminal (macOS) na pasta do trabalho, com `CLAUDE_CONFIG_DIR` da conta
   escolhida e um prompt inicial que manda ler o registro e seguir pelo próximo passo. A sessão nova que aparece
   nessa conta e pasta em até 15 min é ligada ao mesmo trabalho. Em Windows/Linux o Orbit mostra o comando.
4. **Levar a conversa inteira** (opcional, Ajustes): copia o `.jsonl` da sessão para a conta nova e abre com
   `claude --resume <id>`. Gasta mais tokens, porque a conta nova recebe todo o histórico. **Experimental.**

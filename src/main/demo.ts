import type { AccountView, Session, Settings, Snapshot, Work } from '../shared/types.ts'

/**
 * Dados fictícios para prints e demonstrações (ORBIT_DEMO=1). Nada aqui vem da máquina:
 * contas, e-mails, projetos e caminhos são inventados.
 */

const H = 3600_000
const M = 60_000

function session(p: Partial<Session> & Pick<Session, 'id' | 'accountId' | 'project' | 'title' | 'state'>, now: number): Session {
  return {
    pid: 40000 + p.id.length,
    cwd: `/Users/demo/code/${p.project}`,
    model: 'Opus',
    tool: null,
    startedAt: now - 2 * H,
    stateSince: now - 4 * M,
    updatedAt: now - 20_000,
    claudeLinesAdded: null,
    claudeLinesRemoved: null,
    changes: null,
    ...p
  }
}

export function demoSnapshot(settings: Settings, now: number): Snapshot {
  const integration = { statusline: true, hooks: true, statuslineConflict: null }
  const personal: AccountView = {
    id: 'demo-personal',
    configDir: '/Users/demo/.claude',
    name: 'Pessoal',
    email: 'dev@example.com',
    organization: null,
    needsLogin: false,
    launchCommand: 'claude',
    integration,
    state: 'working',
    alert: true,
    usage: {
      fiveHour: { usedPercent: 72, resetsAt: now + 1 * H + 38 * M, renewed: false },
      sevenDay: { usedPercent: 41, resetsAt: now + 3 * 24 * H + 5 * H, renewed: false },
      observedAt: now - 30_000,
      source: 'statusline',
      forecast: { exhaustAt: now + 1 * H + 4 * M, ratePerHour: 26, confidence: 'alta', beforeReset: true, samples: 24 }
    },
    sessions: [
      session(
        {
          id: 'a1',
          accountId: 'demo-personal',
          project: 'orbit',
          title: 'Previsão de esgotamento com média móvel',
          state: 'working',
          tool: 'Edit',
          stateSince: now - 3 * M - 12_000,
          claudeLinesAdded: 184,
          claudeLinesRemoved: 37,
          changes: {
            repoRoot: '/Users/demo/code/orbit',
            branch: 'feat/forecast',
            filesModified: 4,
            filesAdded: 1,
            filesDeleted: 0,
            linesAdded: 212,
            linesRemoved: 41,
            lastFile: 'src/main/forecast.ts'
          }
        },
        now
      ),
      session(
        {
          id: 'a2',
          accountId: 'demo-personal',
          project: 'blog',
          title: 'Migrar posts para MDX',
          state: 'approval',
          tool: 'Bash',
          model: 'Sonnet',
          stateSince: now - 50_000,
          changes: {
            repoRoot: '/Users/demo/code/blog',
            branch: 'main',
            filesModified: 12,
            filesAdded: 3,
            filesDeleted: 2,
            linesAdded: 96,
            linesRemoved: 120,
            lastFile: 'content/posts/hello.mdx'
          }
        },
        now
      )
    ]
  }
  const work: AccountView = {
    id: 'demo-work',
    configDir: '/Users/demo/.claude-work',
    name: 'Trabalho',
    email: 'dev@company.example',
    organization: 'Example Inc',
    needsLogin: false,
    launchCommand: 'CLAUDE_CONFIG_DIR="$HOME/.claude-work" claude',
    integration,
    state: 'waiting',
    alert: false,
    usage: {
      fiveHour: { usedPercent: 18, resetsAt: now + 4 * H + 12 * M, renewed: false },
      sevenDay: { usedPercent: 63, resetsAt: now + 1 * 24 * H + 9 * H, renewed: false },
      observedAt: now - 2 * M,
      source: 'usage',
      forecast: { exhaustAt: null, ratePerHour: 4, confidence: 'média', beforeReset: false, samples: 9 }
    },
    sessions: [
      session(
        {
          id: 'b1',
          accountId: 'demo-work',
          project: 'api-gateway',
          title: 'Revisar testes de rate limit',
          state: 'waiting',
          stateSince: now - 6 * M,
          updatedAt: now - 6 * M,
          claudeLinesAdded: 58,
          claudeLinesRemoved: 12
        },
        now
      )
    ]
  }
  // ORBIT_DEMO_SWITCH=1: conta pessoal quase esgotada; =out: esgotada. Para mostrar a troca de conta.
  const demoSwitch = globalThis.process?.env?.ORBIT_DEMO_SWITCH
  if (demoSwitch === '1' || demoSwitch === 'out') {
    const pct = demoSwitch === 'out' ? 100 : 96
    personal.usage = {
      ...personal.usage,
      fiveHour: { usedPercent: pct, resetsAt: now + 52 * M, renewed: false },
      forecast: { exhaustAt: now + 9 * M, ratePerHour: 28, confidence: 'alta', beforeReset: true, samples: 30 }
    }
  }
  return {
    accounts: [personal, work],
    works: demoWorks(now),
    selectedId: personal.id,
    settings: { ...settings, names: {}, hiddenAccounts: [] },
    generatedAt: now,
    // Também usado pelo vídeo de demonstração (video/), que roda no navegador.
    platform: (globalThis.process?.platform ?? 'darwin') as NodeJS.Platform,
    claudePath: '/usr/local/bin/claude'
  }
}

function demoWorks(now: number): Work[] {
  const base = { requestedAt: null, updatedAt: now - 20_000 }
  return [
    {
      ...base,
      id: 'a1',
      title: 'Previsão de esgotamento com média móvel',
      project: 'orbit',
      cwd: '/Users/demo/code/orbit',
      accountId: 'demo-personal',
      sessionId: 'a1',
      status: 'active',
      noteFile: '/Users/demo/code/orbit/.orbit/trabalhos/a1.md',
      noteBy: 'claude',
      noteAt: now - 2 * M,
      doneItems: 4,
      totalItems: 6,
      next: 'Testes do forecast com janelas renovadas'
    },
    {
      ...base,
      id: 'a2',
      title: 'Migrar posts para MDX',
      project: 'blog',
      cwd: '/Users/demo/code/blog',
      accountId: 'demo-personal',
      sessionId: 'a2',
      status: 'active',
      noteFile: '/Users/demo/code/blog/.orbit/trabalhos/a2.md',
      noteBy: 'orbit',
      noteAt: now - 5 * M,
      doneItems: null,
      totalItems: null,
      next: null,
      requestedAt: now - 5 * M
    },
    {
      ...base,
      id: 'c1',
      title: 'Rate limit no gateway',
      project: 'api-gateway',
      cwd: '/Users/demo/code/api-gateway',
      accountId: 'demo-work',
      sessionId: 'c1',
      status: 'paused',
      noteFile: '/Users/demo/code/api-gateway/.orbit/trabalhos/c1.md',
      noteBy: 'claude',
      noteAt: now - 3 * H,
      doneItems: 2,
      totalItems: 5,
      next: 'Middleware de Redis com janela deslizante',
      updatedAt: now - 3 * H
    }
  ]
}

export const demoNote = `# Previsão de esgotamento com média móvel

## Objetivo
Mostrar quando a janela de 5h chega a 100% no ritmo atual, por conta.

## Feito
- [x] Cálculo em forecast.ts
- [x] Amostras no SQLite por conta
- [x] Tipos compartilhados
- [x] Linha de previsão no popover

## Falta
- [ ] Testes do forecast com janelas renovadas
- [ ] Notificação quando a previsão cai antes do reset

## Decisões e contexto
Média móvel dos últimos 90 min, não regressão de toda a janela: reage mais rápido a mudança de ritmo.

## Arquivos
- src/main/forecast.ts: cálculo
- src/renderer/src/components/MainView.tsx: ForecastLine

## Próximo passo
Testes do forecast com janelas renovadas
`

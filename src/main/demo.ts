import type { AccountView, Session, Settings, Snapshot } from '../shared/types.ts'

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
  return {
    accounts: [personal, work],
    selectedId: personal.id,
    settings: { ...settings, names: {}, hiddenAccounts: [] },
    generatedAt: now,
    // Também usado pelo vídeo de demonstração (video/), que roda no navegador.
    platform: (globalThis.process?.platform ?? 'darwin') as NodeJS.Platform,
    claudePath: '/usr/local/bin/claude'
  }
}

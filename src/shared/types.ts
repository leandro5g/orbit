// Tipos trocados entre o processo principal (coleta) e a interface (popover).

export type SessionState =
  | 'working' // executando ferramentas
  | 'thinking' // prompt recebido, ainda sem ferramenta
  | 'waiting' // terminou o turno e espera o usuário
  | 'approval' // pedindo permissão para uma ferramenta
  | 'completed' // turno concluído há pouco
  | 'error' // turno terminou com erro de API
  | 'idle' // sem atividade

export interface LimitWindow {
  /** Percentual usado, como o Claude Code informa. null quando a janela já renovou e não há leitura nova. */
  usedPercent: number | null
  /** Epoch ms do próximo reset. null: a janela ainda não começou (nenhum uso desde o último reset). */
  resetsAt: number | null
  /** A janela informada já passou do reset. */
  renewed: boolean
}

export type Confidence = 'baixa' | 'média' | 'alta'

export interface Forecast {
  /** Epoch ms estimado para chegar a 100%. null quando o ritmo não leva a esgotar. */
  exhaustAt: number | null
  /** Pontos percentuais por hora, na janela de 5h. */
  ratePerHour: number
  confidence: Confidence
  /** A estimativa cai antes do reset da janela. */
  beforeReset: boolean
  samples: number
}

export interface Usage {
  fiveHour: LimitWindow | null
  sevenDay: LimitWindow | null
  /** Quando o Claude Code entregou a última leitura (epoch ms). */
  observedAt: number | null
  /** statusline: sessão aberta; usage: comando /usage rodado pelo Orbit. */
  source: 'statusline' | 'usage' | null
  forecast: Forecast | null
}

export interface CodeChanges {
  repoRoot: string
  branch: string | null
  filesModified: number
  filesAdded: number
  filesDeleted: number
  linesAdded: number
  linesRemoved: number
  lastFile: string | null
}

export interface Session {
  id: string
  pid: number
  accountId: string
  project: string
  cwd: string
  title: string
  model: string | null
  state: SessionState
  /** Ferramenta em uso, quando os hooks estão instalados. */
  tool: string | null
  startedAt: number
  /** Início do estado atual (epoch ms). */
  stateSince: number
  updatedAt: number
  /** Linhas que o Claude escreveu nesta sessão (statusline). */
  claudeLinesAdded: number | null
  claudeLinesRemoved: number | null
  /** Alterações não commitadas no repositório da sessão (git). */
  changes: CodeChanges | null
}

export interface Integration {
  statusline: boolean
  hooks: boolean
  /** Outra statusline já ocupa o lugar e não foi substituída. */
  statuslineConflict: string | null
}

export interface Account {
  id: string
  configDir: string
  name: string
  email: string | null
  organization: string | null
  /** Sem identidade no .claude.json: a conta ainda não fez login no Claude Code. */
  needsLogin: boolean
  /** Comando para abrir o Claude Code nesta conta. */
  launchCommand: string
  integration: Integration
}

export interface AccountView extends Account {
  usage: Usage
  sessions: Session[]
  state: SessionState
  /** Uso >= primeiro limiar de alerta, ou esgotamento previsto antes do reset. */
  alert: boolean
}

export interface Settings {
  alertsEnabled: boolean
  thresholds: number[]
  notifyExhaustion: boolean
  notifyReset: boolean
  notifyApproval: boolean
  notifyCompletion: boolean
  notifyError: boolean
  openAtLogin: boolean
  names: Record<string, string>
  hiddenAccounts: string[]
  extraConfigDirs: string[]
  selectedAccountId: string | null
  /** Caminho do binário do Claude Code escolhido à mão (quando não é encontrado sozinho). */
  claudePath: string | null
  integrationHintDismissed: boolean
  /** Registrar os trabalhos abertos antes de a conta esgotar. */
  handoffEnabled: boolean
  /** Uso (%) em que o Orbit pede ao Claude o registro de continuação. */
  handoffAt: number
  /** Uso (%) em que aparece o "tokens terminando, deseja trocar de conta?". */
  switchAlertAt: number
  /** Ao continuar em outra conta, levar a conversa inteira (gasta mais) em vez de só o registro. */
  handoffFullHistory: boolean
}

export type WorkStatus = 'active' | 'paused' | 'done'

/**
 * Trabalho: a tarefa, não a sessão. Nasce de uma sessão do Claude Code e sobrevive a ela:
 * quando a conta esgota, continua em outra conta a partir do registro de continuação.
 */
export interface Work {
  id: string
  title: string
  project: string
  /** Pasta onde o Claude Code roda (raiz do repo quando há git). */
  cwd: string
  /** Conta da sessão mais recente. */
  accountId: string
  sessionId: string
  status: WorkStatus
  /** Registro de continuação: <repo>/.orbit/trabalhos/<id>.md */
  noteFile: string
  /** Quem escreveu o registro: o Claude (resumo completo) ou o Orbit (sem tokens, a partir do histórico). */
  noteBy: 'claude' | 'orbit' | null
  noteAt: number | null
  /** Checklist do registro: itens feitos e total. */
  doneItems: number | null
  totalItems: number | null
  next: string | null
  /** Pedido de registro enviado ao Claude e ainda não atendido. */
  requestedAt: number | null
  updatedAt: number
}

export interface Snapshot {
  accounts: AccountView[]
  selectedId: string | null
  settings: Settings
  generatedAt: number
  platform: NodeJS.Platform
  /** Binário do Claude Code encontrado. null: não instalado ou fora dos lugares comuns. */
  claudePath: string | null
  works: Work[]
}

export interface ActionResult {
  ok: boolean
  message: string
}

export interface OrbitApi {
  getSnapshot(): Promise<Snapshot>
  onSnapshot(cb: (s: Snapshot) => void): () => void
  onShown(cb: () => void): () => void
  selectAccount(id: string): Promise<void>
  renameAccount(id: string, name: string): Promise<void>
  removeAccount(id: string): Promise<void>
  restoreAccounts(): Promise<void>
  addAccount(): Promise<ActionResult>
  createAccount(name: string): Promise<ActionResult & { command?: string }>
  loginAccount(id: string): Promise<ActionResult & { command?: string }>
  checkClaude(): Promise<void>
  pickClaudePath(): Promise<ActionResult>
  refresh(): Promise<void>
  installIntegration(id: string): Promise<ActionResult>
  updateSettings(patch: Partial<Settings>): Promise<void>
  resize(height: number): void
  openPath(path: string): void
  quit(): void
  onNavigate(cb: (to: { view: 'works' | 'switch'; from?: string }) => void): () => void
  /** Continua o trabalho na conta escolhida: abre o Terminal na pasta, já na conta, lendo o registro. */
  continueWork(workId: string, accountId: string): Promise<ActionResult & { command?: string; opened?: boolean }>
  /** Pede o registro de continuação agora (ao Claude, se houver hooks; senão, o Orbit escreve). */
  saveWork(workId: string): Promise<ActionResult>
  readWorkNote(workId: string): Promise<string | null>
  renameWork(workId: string, title: string): Promise<void>
  finishWork(workId: string): Promise<void>
  dismissWork(workId: string): Promise<void>
}

export const STATE_PRIORITY: SessionState[] = [
  'error',
  'approval',
  'working',
  'thinking',
  'waiting',
  'completed',
  'idle'
]

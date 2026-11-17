import { app, BrowserWindow, dialog, ipcMain, Menu, Notification, screen, shell, Tray } from 'electron'
import { join } from 'node:path'
import { formatRemaining, overallState, STATE_LABEL, STATE_TONE } from '../shared/format.ts'
import type { AccountView, ActionResult, Settings, Snapshot } from '../shared/types.ts'
import { existsSync, mkdirSync } from 'node:fs'
import { accountIdFor, DEFAULT_CONFIG_DIR, HOME } from './paths.ts'
import { defaultName, discoverAccounts, looksLikeConfigDir } from './accounts.ts'
import { fetchUsage, findClaude, openClaudeTerminal, openLoginTerminal, type CliUsage } from './claude-cli.ts'
import { LocalStore } from './db.ts'
import { installIntegration, upgradeHookScript } from './integration.ts'
import { Notifier } from './notifications.ts'
import { readSessions } from './sessions.ts'
import { orbitTrayIcon } from './tray-icon.ts'
import { buildUsage, scanStatusline } from './usage.ts'
import { demoNote, demoSnapshot } from './demo.ts'
import { WorkTracker } from './works.ts'

const isMac = process.platform === 'darwin'
const WIDTH = 392
const TICK_MS = 3000
/** /usage por conta: a cada 5 min, ou 90 s quando o popover abre. */
const USAGE_EVERY_MS = 5 * 60_000
const USAGE_ON_OPEN_MS = 90_000
/** ORBIT_DEMO=1: dados fictícios, para prints e demonstrações. */
const DEMO = process.env.ORBIT_DEMO === '1'

const DEFAULT_SETTINGS: Settings = {
  alertsEnabled: true,
  thresholds: [70, 85, 95],
  notifyExhaustion: true,
  notifyReset: true,
  notifyApproval: true,
  notifyCompletion: false,
  notifyError: true,
  openAtLogin: false,
  names: {},
  hiddenAccounts: [],
  extraConfigDirs: [],
  selectedAccountId: null,
  claudePath: null,
  integrationHintDismissed: false,
  handoffEnabled: true,
  handoffAt: 90,
  switchAlertAt: 95,
  handoffFullHistory: false
}

let tray: Tray | null = null
let win: BrowserWindow | null = null
let store: LocalStore
let notifier: Notifier
let works: WorkTracker
let settings: Settings
let snapshot: Snapshot | null = null
let lastSent = ''
let ticking = false
let lastHiddenAt = 0
let claudePath: string | null = null
const cliUsage = new Map<string, CliUsage>()
let cliRunning = false

if (!app.requestSingleInstanceLock()) app.quit()

function saveSettings(patch: Partial<Settings>): void {
  settings = { ...settings, ...patch }
  store.set('settings', settings)
  if ('openAtLogin' in patch) app.setLoginItemSettings({ openAtLogin: settings.openAtLogin })
}

// ---------- coleta ----------

async function collect(): Promise<Snapshot> {
  const now = Date.now()
  if (DEMO) return demoSnapshot(settings, now)
  const accounts = discoverAccounts(settings)
  const views: AccountView[] = []
  for (const acc of accounts) {
    const scan = scanStatusline(acc.id, now)
    const usage = buildUsage(acc.id, scan, cliUsage.get(acc.id) ?? null, store, now)
    const sessions = await readSessions(acc, scan, now)
    for (const s of sessions) store.touchSession(s.id, acc.id, s.project, s.cwd, s.state, now)
    const first = settings.thresholds.length ? Math.min(...settings.thresholds) : 101
    const pct = Math.max(usage.fiveHour?.usedPercent ?? 0, usage.sevenDay?.usedPercent ?? 0)
    views.push({
      ...acc,
      usage,
      sessions,
      state: overallState(sessions),
      alert: pct >= first || !!(usage.forecast?.beforeReset && usage.forecast.confidence !== 'baixa')
    })
  }
  let selectedId = settings.selectedAccountId
  if (!views.some((v) => v.id === selectedId)) {
    selectedId = views.find((v) => v.usage.fiveHour)?.id ?? views[0]?.id ?? null
  }
  const workList = works.sync(views, settings, now)
  return { accounts: views, selectedId, settings, generatedAt: now, platform: process.platform, claudePath, works: workList }
}

/** "Tokens terminando, deseja trocar de conta?": o clique abre o Orbit na tela de troca. */
function switchAlert(from: AccountView, count: number): void {
  if (!Notification.isSupported()) return
  const pct = Math.max(from.usage.fiveHour?.usedPercent ?? 0, from.usage.sevenDay?.usedPercent ?? 0)
  const n = new Notification({
    title: `${from.name} em ${pct}%: trocar de conta?`,
    body: `${count === 1 ? 'O trabalho aberto está salvo' : `Os ${count} trabalhos abertos estão salvos`}. Clique para escolher a conta e continuar.`
  })
  n.on('click', () => navigate({ view: 'switch', from: from.id }))
  n.show()
}

function navigate(to: { view: 'works' | 'switch'; from?: string }): void {
  showWindow()
  win?.webContents.send('orbit:navigate', to)
}

/** Atualiza o uso de cada conta com o /usage do Claude Code. Uma conta por vez, em segundo plano. */
async function refreshCliUsage(maxAge = USAGE_EVERY_MS, only?: string): Promise<void> {
  if (cliRunning || DEMO) return
  cliRunning = true
  try {
    claudePath = await findClaude(settings.claudePath)
    if (process.env.ORBIT_DEBUG) console.log('[orbit] claude =', claudePath)
    if (!claudePath) return
    for (const acc of discoverAccounts(settings)) {
      if (acc.needsLogin || (only && acc.id !== only)) continue
      const last = cliUsage.get(acc.id)
      if (last && Date.now() - last.at < maxAge) continue
      const r = await fetchUsage(claudePath, acc.configDir)
      if (process.env.ORBIT_DEBUG) console.log('[orbit] /usage', acc.id, r.ok, r.fiveHour, r.sevenDay)
      cliUsage.set(acc.id, r)
    }
  } finally {
    cliRunning = false
  }
  await tick()
}

async function tick(): Promise<void> {
  if (ticking) return
  ticking = true
  try {
    snapshot = await collect()
    if (!DEMO) notifier.run(snapshot.accounts, settings, snapshot.generatedAt)
    updateTray(snapshot)
    // Conta que acabou de fazer login (ou nunca foi lida): busca o uso já.
    if (claudePath && snapshot.accounts.some((a) => !a.needsLogin && !cliUsage.has(a.id))) void refreshCliUsage()
    const { generatedAt: _g, ...comparable } = snapshot
    const json = JSON.stringify(comparable)
    if (json !== lastSent && win && !win.isDestroyed()) {
      lastSent = json
      win.webContents.send('orbit:snapshot', snapshot)
    }
  } catch (e) {
    console.error('[orbit] falha na coleta', e)
  } finally {
    ticking = false
  }
}

// ---------- menu bar ----------

const TONE_DOT = { green: '🟢', yellow: '🟡', red: '🔴', gray: '⚪' } as const

function trayText(s: Snapshot): string {
  const acc = s.accounts.find((a) => a.id === s.selectedId)
  if (!acc) return 'Orbit'
  const dot = TONE_DOT[STATE_TONE[acc.state]]
  const label = acc.state === 'idle' ? '' : ` ${STATE_LABEL[acc.state]} |`
  const w = acc.usage.fiveHour
  const usage = !w
    ? '—'
    : w.renewed
      ? 'renovada'
      : w.resetsAt
        ? `${w.usedPercent}% · ${formatRemaining(w.resetsAt - s.generatedAt)}`
        : `${w.usedPercent}%`
  return `${dot}${label} ${usage}`
}

function updateTray(s: Snapshot): void {
  if (!tray) return
  const text = trayText(s)
  if (isMac) tray.setTitle(` ${text}`, { fontType: 'monospacedDigit' })
  tray.setToolTip(`Orbit — ${text}`)
}

function createTray(): void {
  tray = new Tray(orbitTrayIcon())
  tray.setToolTip('Orbit')
  if (isMac) tray.setTitle(' Orbit')
  const menu = Menu.buildFromTemplate([
    { label: 'Abrir Orbit', click: () => showWindow() },
    { label: 'Atualizar agora', click: () => void tick() },
    { type: 'separator' },
    { label: 'Sair do Orbit', role: 'quit' }
  ])
  tray.on('click', () => toggleWindow())
  tray.on('right-click', () => tray?.popUpContextMenu(menu))
  if (process.platform === 'linux') tray.setContextMenu(menu) // várias bandejas do Linux só abrem menu
}

// ---------- popover ----------

function createWindow(): void {
  win = new BrowserWindow({
    width: WIDTH,
    height: 520,
    show: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  })
  if (isMac) win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  win.on('blur', () => {
    if (win && !win.webContents.isDevToolsOpened()) {
      win.hide()
      lastHiddenAt = Date.now()
    }
  })
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  if (process.env.ELECTRON_RENDERER_URL) void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void win.loadFile(join(__dirname, '../renderer/index.html'))
}

function positionWindow(): void {
  if (!win || !tray) return
  const tb = tray.getBounds()
  const { width, height } = win.getBounds()
  const point = tb.width ? { x: tb.x, y: tb.y } : screen.getCursorScreenPoint()
  const wa = screen.getDisplayNearestPoint(point).workArea
  const clampX = (x: number) => Math.min(Math.max(x, wa.x + 6), wa.x + wa.width - width - 6)
  if (!tb.width) {
    // Bandejas do Linux sem posição: canto superior direito.
    win.setPosition(wa.x + wa.width - width - 6, wa.y + 6)
    return
  }
  const top = tb.y < wa.y + wa.height / 2
  const x = clampX(Math.round(tb.x + tb.width / 2 - width / 2))
  const y = top ? Math.round(tb.y + tb.height + 2) : Math.round(tb.y - height - 2)
  win.setPosition(x, y)
}

function showWindow(): void {
  if (!win) return
  positionWindow()
  win.show()
  win.focus()
  win.webContents.send('orbit:shown')
  void refreshCliUsage(USAGE_ON_OPEN_MS)
  if (snapshot) win.webContents.send('orbit:snapshot', snapshot)
}

function toggleWindow(): void {
  if (!win) return
  if (win.isVisible()) win.hide()
  else if (Date.now() - lastHiddenAt > 250) showWindow() // o clique no ícone já escondeu pelo blur
}

// ---------- ações ----------

async function addAccount(): Promise<ActionResult> {
  const res = await dialog.showOpenDialog({
    title: 'Pasta de configuração da conta do Claude Code',
    message: 'Escolha a pasta usada em CLAUDE_CONFIG_DIR (ex.: ~/.claude-trabalho).',
    defaultPath: DEFAULT_CONFIG_DIR,
    properties: ['openDirectory', 'showHiddenFiles']
  })
  const dir = res.filePaths[0]
  if (res.canceled || !dir) return { ok: false, message: 'Nenhuma pasta escolhida.' }
  if (!looksLikeConfigDir(dir))
    return { ok: false, message: 'Essa pasta não parece uma conta do Claude Code (sem settings.json nem .claude.json).' }
  const id = accountIdFor(dir)
  saveSettings({
    extraConfigDirs: [...new Set([...settings.extraConfigDirs, dir])],
    hiddenAccounts: settings.hiddenAccounts.filter((h) => h !== id),
    selectedAccountId: id
  })
  await tick()
  return { ok: true, message: `Conta "${id}" adicionada.` }
}

function slug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30)
}

async function loginFor(configDir: string, label: string): Promise<ActionResult & { command?: string }> {
  const claude = await findClaude(settings.claudePath, true)
  claudePath = claude
  if (!claude) return { ok: false, message: 'Claude Code não encontrado. Instale ou indique o caminho em Ajustes.' }
  const r = openLoginTerminal(claude, configDir, label)
  if (r.opened) {
    await shell.openPath(r.opened)
    return { ok: true, message: 'Abri o Terminal. Faça o login no navegador quando o Claude Code pedir.', command: r.command }
  }
  return { ok: true, message: 'Rode este comando num terminal e faça o login:', command: r.command }
}

/** Nova conta: cria ~/.claude-<nome>, já com a integração, e abre o login oficial do Claude Code. */
async function createAccount(name: string): Promise<ActionResult & { command?: string }> {
  const clean = name.trim().slice(0, 40)
  const s = slug(clean)
  if (!s) return { ok: false, message: 'Dê um nome com letras ou números.' }
  const dir = join(HOME, `.claude-${s}`)
  const id = accountIdFor(dir)
  if (existsSync(dir)) return { ok: false, message: `Já existe ${dir.replace(HOME, '~')}. Use "Usar pasta existente".` }
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  installIntegration(dir)
  saveSettings({
    names: { ...settings.names, [id]: clean || defaultName(id) },
    hiddenAccounts: settings.hiddenAccounts.filter((h) => h !== id),
    selectedAccountId: id
  })
  const r = await loginFor(dir, clean)
  await tick()
  return r
}

function registerIpc(): void {
  ipcMain.handle('orbit:getSnapshot', async () => snapshot ?? (await collect()))
  ipcMain.handle('orbit:selectAccount', async (_e, id: string) => {
    saveSettings({ selectedAccountId: id })
    await tick()
  })
  ipcMain.handle('orbit:renameAccount', async (_e, id: string, name: string) => {
    const names = { ...settings.names }
    if (name.trim()) names[id] = name.trim().slice(0, 40)
    else delete names[id]
    saveSettings({ names })
    await tick()
  })
  ipcMain.handle('orbit:removeAccount', async (_e, id: string) => {
    saveSettings({
      hiddenAccounts: [...new Set([...settings.hiddenAccounts, id])],
      extraConfigDirs: settings.extraConfigDirs.filter((d) => accountIdFor(d) !== id),
      selectedAccountId: settings.selectedAccountId === id ? null : settings.selectedAccountId
    })
    await tick()
  })
  ipcMain.handle('orbit:restoreAccounts', async () => {
    saveSettings({ hiddenAccounts: [] })
    await tick()
  })
  ipcMain.handle('orbit:addAccount', () => addAccount())
  ipcMain.handle('orbit:refresh', () => refreshCliUsage(0))
  ipcMain.handle('orbit:createAccount', (_e, name: string) => createAccount(String(name ?? '')))
  ipcMain.handle('orbit:loginAccount', async (_e, id: string) => {
    const acc = snapshot?.accounts.find((a) => a.id === id)
    if (!acc) return { ok: false, message: 'Conta não encontrada.' }
    cliUsage.delete(id)
    return loginFor(acc.configDir, acc.name)
  })
  ipcMain.handle('orbit:checkClaude', async () => {
    claudePath = await findClaude(settings.claudePath, true)
    await refreshCliUsage(0)
  })
  ipcMain.handle('orbit:pickClaudePath', async () => {
    const res = await dialog.showOpenDialog({
      title: 'Onde está o Claude Code?',
      message: 'Escolha o executável claude (no terminal: command -v claude).',
      properties: ['openFile', 'showHiddenFiles']
    })
    const file = res.filePaths[0]
    if (res.canceled || !file) return { ok: false, message: 'Nenhum arquivo escolhido.' }
    const found = await findClaude(file, true)
    if (found !== file) return { ok: false, message: 'Esse arquivo não é executável.' }
    saveSettings({ claudePath: file })
    claudePath = file
    await refreshCliUsage(0)
    return { ok: true, message: 'Claude Code encontrado.' }
  })
  ipcMain.handle('orbit:installIntegration', async (_e, id: string) => {
    const acc = snapshot?.accounts.find((a) => a.id === id)
    if (!acc) return { ok: false, message: 'Conta não encontrada.' }
    const r = installIntegration(acc.configDir)
    await tick()
    return r
  })
  ipcMain.handle('orbit:updateSettings', async (_e, patch: Partial<Settings>) => {
    saveSettings(patch)
    await tick()
  })
  ipcMain.on('orbit:resize', (_e, height: number) => {
    if (!win) return
    const h = Math.min(Math.max(Math.round(height), 160), 760)
    if (win.getBounds().height !== h) {
      win.setSize(WIDTH, h)
      if (win.isVisible()) positionWindow()
    }
  })
  ipcMain.on('orbit:openPath', (_e, p: string) => {
    if (typeof p === 'string' && p.startsWith('/')) void shell.openPath(p)
  })
  ipcMain.on('orbit:quit', () => app.quit())

  ipcMain.handle('orbit:continueWork', async (_e, workId: string, accountId: string) => {
    if (DEMO) return { ok: true, message: 'Demonstração: abriria o Terminal na conta escolhida.' }
    const accs = snapshot?.accounts ?? []
    const to = accs.find((a) => a.id === accountId)
    if (!to) return { ok: false, message: 'Conta não encontrada.' }
    if (to.needsLogin) return { ok: false, message: `${to.name} ainda não fez login.` }
    const claude = await findClaude(settings.claudePath)
    if (!claude) return { ok: false, message: 'Claude Code não encontrado.' }
    const from = accs.find((a) => a.id === works.accountOf(workId))
    const r = await works.prepareContinue(workId, from, to, settings.handoffFullHistory, Date.now())
    if ('error' in r) return { ok: false, message: r.error }
    const t = openClaudeTerminal(claude, {
      configDir: to.configDir,
      cwd: r.cwd,
      label: `continuar-${workId.slice(0, 8)}`,
      args: r.args,
      banner: [`Orbit · continuando "${r.title}" na conta ${to.name}`]
    })
    await tick()
    if (t.opened) {
      await shell.openPath(t.opened)
      return { ok: true, opened: true, message: `Abri o Terminal em ${to.name}. O Claude começa lendo o registro de continuação.`, command: t.command }
    }
    return { ok: true, opened: false, message: 'Rode este comando num terminal para continuar:', command: t.command }
  })
  ipcMain.handle('orbit:saveWork', async (_e, workId: string) => {
    if (DEMO) return { ok: true, message: 'Demonstração: o registro seria salvo.' }
    const acc = snapshot?.accounts.find((a) => a.id === works.accountOf(workId))
    const pct = acc ? Math.max(acc.usage.fiveHour?.usedPercent ?? 0, acc.usage.sevenDay?.usedPercent ?? 0) : null
    const r = await works.requestNote(workId, acc, pct, Date.now())
    await tick()
    if (!r) return { ok: false, message: 'Não consegui salvar o registro.' }
    return r.asked
      ? { ok: true, message: 'Rascunho salvo. O Claude escreve o registro completo no fim do turno atual (ou do próximo).' }
      : { ok: true, message: 'Registro salvo pelo Orbit a partir do histórico (sem hooks, o Claude não é chamado).' }
  })
  ipcMain.handle('orbit:readWorkNote', (_e, workId: string) => (DEMO ? demoNote : works.noteText(workId)))
  ipcMain.handle('orbit:renameWork', async (_e, workId: string, title: string) => {
    works.rename(workId, String(title ?? ''))
    await tick()
  })
  ipcMain.handle('orbit:finishWork', async (_e, workId: string) => {
    works.finish(workId, Date.now())
    await tick()
  })
  ipcMain.handle('orbit:dismissWork', async (_e, workId: string) => {
    works.dismiss(workId)
    await tick()
  })
}

// ---------- ciclo de vida ----------

app.on('second-instance', () => showWindow())
app.on('window-all-closed', () => {
  /* fica na menu bar */
})

void app.whenReady().then(async () => {
  if (isMac) app.dock?.hide()
  store = new LocalStore(join(app.getPath('userData'), 'orbit.db'))
  store.prune(Date.now())
  settings = { ...DEFAULT_SETTINGS, ...store.get<Partial<Settings>>('settings', {}) }
  notifier = new Notifier(store)
  works = new WorkTracker(store, switchAlert)
  upgradeHookScript()
  registerIpc()
  createTray()
  createWindow()
  await tick()
  void refreshCliUsage()
  setInterval(() => void refreshCliUsage(), 60_000)
  if (process.env.ORBIT_OPEN === '1') win?.webContents.once('did-finish-load', () => showWindow())
  // Dev: ORBIT_CAPTURE=/caminho.png grava um print do popover (sem precisar de permissão de tela).
  const capture = process.env.ORBIT_CAPTURE
  if (capture) {
    setTimeout(async () => {
      const { writeFileSync } = await import('node:fs')
      // ORBIT_CAPTURE_CLICK: seletor CSS clicado antes do print (ex.: abrir outra tela).
      const click = process.env.ORBIT_CAPTURE_CLICK
      if (click) {
        await win!.webContents.executeJavaScript(`document.querySelector(${JSON.stringify(click)})?.click()`)
        await new Promise((r) => setTimeout(r, 600))
      }
      const img = await win!.webContents.capturePage()
      writeFileSync(capture, img.toPNG())
      console.log('[orbit] capturado', capture, '| menu bar:', snapshot && trayText(snapshot))
    }, Number(process.env.ORBIT_CAPTURE_DELAY ?? 2500))
  }
  setInterval(() => void tick(), TICK_MS)
  setInterval(() => store.prune(Date.now()), 6 * 3600_000)
})

app.on('before-quit', () => store?.close())

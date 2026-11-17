import { contextBridge, ipcRenderer } from 'electron'
import type { OrbitApi, Snapshot } from '../shared/types'

const api: OrbitApi = {
  getSnapshot: () => ipcRenderer.invoke('orbit:getSnapshot'),
  onSnapshot: (cb) => {
    const fn = (_e: unknown, s: Snapshot) => cb(s)
    ipcRenderer.on('orbit:snapshot', fn)
    return () => ipcRenderer.off('orbit:snapshot', fn)
  },
  onShown: (cb) => {
    const fn = () => cb()
    ipcRenderer.on('orbit:shown', fn)
    return () => ipcRenderer.off('orbit:shown', fn)
  },
  selectAccount: (id) => ipcRenderer.invoke('orbit:selectAccount', id),
  renameAccount: (id, name) => ipcRenderer.invoke('orbit:renameAccount', id, name),
  removeAccount: (id) => ipcRenderer.invoke('orbit:removeAccount', id),
  restoreAccounts: () => ipcRenderer.invoke('orbit:restoreAccounts'),
  addAccount: () => ipcRenderer.invoke('orbit:addAccount'),
  createAccount: (name) => ipcRenderer.invoke('orbit:createAccount', name),
  loginAccount: (id) => ipcRenderer.invoke('orbit:loginAccount', id),
  checkClaude: () => ipcRenderer.invoke('orbit:checkClaude'),
  pickClaudePath: () => ipcRenderer.invoke('orbit:pickClaudePath'),
  refresh: () => ipcRenderer.invoke('orbit:refresh'),
  installIntegration: (id) => ipcRenderer.invoke('orbit:installIntegration', id),
  updateSettings: (patch) => ipcRenderer.invoke('orbit:updateSettings', patch),
  resize: (h) => ipcRenderer.send('orbit:resize', h),
  openPath: (p) => ipcRenderer.send('orbit:openPath', p),
  quit: () => ipcRenderer.send('orbit:quit'),
  onNavigate: (cb) => {
    const fn = (_e: unknown, to: { view: 'works' | 'switch'; from?: string }) => cb(to)
    ipcRenderer.on('orbit:navigate', fn)
    return () => ipcRenderer.off('orbit:navigate', fn)
  },
  continueWork: (workId, accountId) => ipcRenderer.invoke('orbit:continueWork', workId, accountId),
  saveWork: (workId) => ipcRenderer.invoke('orbit:saveWork', workId),
  readWorkNote: (workId) => ipcRenderer.invoke('orbit:readWorkNote', workId),
  renameWork: (workId, title) => ipcRenderer.invoke('orbit:renameWork', workId, title),
  finishWork: (workId) => ipcRenderer.invoke('orbit:finishWork', workId),
  dismissWork: (workId) => ipcRenderer.invoke('orbit:dismissWork', workId)
}

contextBridge.exposeInMainWorld('orbit', api)

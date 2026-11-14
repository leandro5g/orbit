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
  quit: () => ipcRenderer.send('orbit:quit')
}

contextBridge.exposeInMainWorld('orbit', api)

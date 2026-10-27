const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ricamo', Object.freeze({
  load: () => ipcRenderer.invoke('ricamo:load'),
  command: (command, revision) => ipcRenderer.invoke('ricamo:command', command, revision),
  importAsset: (asset, revision) => ipcRenderer.invoke('ricamo:import-asset', asset, revision),
  getAsset: id => ipcRenderer.invoke('ricamo:get-asset', id),
  saveFile: file => ipcRenderer.invoke('ricamo:save-file', file),
  backup: () => ipcRenderer.invoke('ricamo:backup'),
  inspectRestore: text => ipcRenderer.invoke('ricamo:inspect-restore', text),
  restore: (token, revision) => ipcRenderer.invoke('ricamo:restore', token, revision),
  print: () => ipcRenderer.invoke('ricamo:print'),
}));

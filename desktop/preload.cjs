const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ricamo', Object.freeze({
  exportProject: (id, options) => ipcRenderer.invoke('ricamo:export-project', id, options),
  inspectProject: text => ipcRenderer.invoke('ricamo:inspect-project', text),
  importProject: (token, decisions, revision) => ipcRenderer.invoke('ricamo:import-project', token, decisions, revision),
  load: () => ipcRenderer.invoke('ricamo:load'),
  command: (command, revision) => ipcRenderer.invoke('ricamo:command', command, revision),
  createPatternWithAsset: (request, revision) => ipcRenderer.invoke('ricamo:create-pattern-with-asset', request, revision),
  importAsset: (asset, revision) => ipcRenderer.invoke('ricamo:import-asset', asset, revision),
  getAsset: id => ipcRenderer.invoke('ricamo:get-asset', id),
  saveFile: file => ipcRenderer.invoke('ricamo:save-file', file),
  backup: () => ipcRenderer.invoke('ricamo:backup'),
  backupStatus: () => ipcRenderer.invoke('ricamo:backup-status'),
  configureBackup: patch => ipcRenderer.invoke('ricamo:configure-backup', patch),
  chooseBackupFolder: remove => ipcRenderer.invoke('ricamo:choose-backup-folder', remove),
  runBackup: () => ipcRenderer.invoke('ricamo:run-backup'),
  setCloseGuard: value => ipcRenderer.invoke('ricamo:set-close-guard', value),
  finishClose: () => ipcRenderer.invoke('ricamo:finish-close'),
  onCloseRequest: callback => {
    const listener = () => callback();
    ipcRenderer.on('ricamo:request-close', listener);
    return () => ipcRenderer.removeListener('ricamo:request-close', listener);
  },
  inspectRestore: text => ipcRenderer.invoke('ricamo:inspect-restore', text),
  restore: (token, revision) => ipcRenderer.invoke('ricamo:restore', token, revision),
  print: () => ipcRenderer.invoke('ricamo:print'),
}));

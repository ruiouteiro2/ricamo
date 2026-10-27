const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('ricamoExample', Object.freeze({
  cancelClose: () => ipcRenderer.invoke('ricamo-example:cancel-close'),
  close: () => ipcRenderer.invoke('ricamo-example:close'),
  setCloseGuard: value => ipcRenderer.invoke('ricamo-example:set-close-guard', value),
  finishClose: () => ipcRenderer.invoke('ricamo-example:finish-close'),
  onCloseRequest: callback => {
    const listener = () => callback(); ipcRenderer.on('ricamo-example:request-close', listener);
    return () => ipcRenderer.removeListener('ricamo-example:request-close', listener);
  },
}));

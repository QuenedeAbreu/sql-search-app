const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  readFiles: (dir) => ipcRenderer.invoke('read-files', dir),
  readFileContent: (path) => ipcRenderer.invoke('read-file-content', path),
  watchFolder: (dir) => ipcRenderer.invoke('watch-folder', dir),
  onFolderUpdate: (callback) => ipcRenderer.on('folder-updated', (event, path) => callback(path)),
  saveFile: (path, content) => ipcRenderer.invoke('save-file', path, content),
  saveAsFile: (content) => ipcRenderer.invoke('save-as-file', content),
  toggleWatch: () => ipcRenderer.invoke('toggle-watch'),
  getDefaultFolder: () => ipcRenderer.invoke('get-default-folder'),
  saveLastFolder: (path) => ipcRenderer.invoke('save-last-folder', path),
  getLastFolder: () => ipcRenderer.invoke('get-last-folder'),
});
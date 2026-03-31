const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const iconv = require('iconv-lite');
const chardet = require('chardet');
const storeFile = path.join(app.getPath('userData'), 'last-folder.json');
let chokidar;
let mainWindow;
let watcher;
let isWatching = true;
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    icon: path.join(__dirname, 'sql_search.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('renderer/index.html');
}
ipcMain.handle('save-last-folder', (event, folderPath) => {
  fs.writeFileSync(storeFile, JSON.stringify({ folderPath }));
});

// cria apenas UMA janela
app.whenReady().then(createWindow);

// evita abrir múltiplas janelas no macOS
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

//selecionar pasta
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });

  if (result.canceled) return null;

  return result.filePaths[0];
});

ipcMain.handle('get-last-folder', () => {
  if (!fs.existsSync(storeFile)) return null;

  try {
    const data = JSON.parse(fs.readFileSync(storeFile, 'utf-8'));

    if (data.folderPath && fs.existsSync(data.folderPath)) {
      return data.folderPath;
    }
  } catch (e) {
    return null;
  }

  return null;
});

ipcMain.handle('read-files', (event, dir) => {
  function getAllSQLFiles(currentDir, baseDir) {
    let results = [];
    const items = fs.readdirSync(currentDir);
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        results = results.concat(getAllSQLFiles(fullPath, baseDir));
      } else if (item.endsWith('.sql')) {
        results.push({
          name: item,
          path: fullPath,
          relativePath: path.relative(baseDir, fullPath),
          createdAt: stat.birthtime,
          modifiedAt: stat.mtime
        });
      }
    }
    return results;
  }
  return getAllSQLFiles(dir, dir);
});

// ler conteúdo sob demanda (performance melhor)
ipcMain.handle('read-file-content', (event, filePath) => {
  const buffer = fs.readFileSync(filePath);

  // 🔥 detecta encoding
  const encoding = chardet.detect(buffer) || 'UTF-8';

  try {
    return iconv.decode(buffer, encoding);
  } catch (e) {
    // fallback
    return buffer.toString('utf-8');
  }
});

ipcMain.handle('toggle-watch', () => {
  isWatching = !isWatching;
  return isWatching;
});

// monitorar pasta (SEM abrir nova janela)
ipcMain.handle('watch-folder', async (event, dir) => {
  if (!chokidar) {
    chokidar = (await import('chokidar')).default;
  }

  if (watcher) watcher.close();

  watcher = chokidar.watch(dir);

  watcher.on('add', (filePath) => {
    if (isWatching) {
      mainWindow.webContents.send('folder-updated', filePath);
    }
  });

  watcher.on('unlink', (filePath) => {
    if (isWatching) {
      mainWindow.webContents.send('folder-updated', filePath);
    }
  });

  watcher.on('change', (filePath) => {
    if (isWatching) {
      mainWindow.webContents.send('folder-updated', filePath);
    }
  });

  watcher.on('unlink', () => {
    if (isWatching) {
      mainWindow.webContents.send('folder-updated');
    }
  });

  watcher.on('change', () => { // 🔥 EXTRA importante
    if (isWatching) {
      mainWindow.webContents.send('folder-updated');
    }
  });
});

//salvar arquivo
ipcMain.handle('save-file', (event, filePath, content) => {
  fs.writeFileSync(filePath, content, 'utf-8');
  return true;
});

//salvar como novo arquivo
ipcMain.handle('save-as-file', async (event, content) => {
  const result = await dialog.showSaveDialog({
    filters: [{ name: 'SQL', extensions: ['sql'] }]
  });

  if (result.canceled) return null;

  fs.writeFileSync(result.filePath, content, 'utf-8');

  return result.filePath;
});
// pasta padrão
ipcMain.handle('get-default-folder', () => {
  const defaultPath = path.join(app.getPath('documents'), 'sql-files');
  // você pode mudar aqui

  if (fs.existsSync(defaultPath)) {
    return defaultPath;
  }
  return null;
});
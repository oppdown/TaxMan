'use strict';

const { app, BrowserWindow, dialog, ipcMain, shell, Menu } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { buildReportHtml, normalizeStore, validateStore, serializeCsv } = require('./core.cjs');
const { createApplicationMenuTemplate } = require('./menu.cjs');

const DATA_FILE = 'data.json';
const BACKUP_FILE = 'data.backup.json';
let mainWindow;

function dataPath() { return path.join(app.getPath('userData'), DATA_FILE); }
function backupPath() { return path.join(app.getPath('userData'), BACKUP_FILE); }

function sendMenuAction(action) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('menu:action', action);
}

async function readStore() {
  try {
    const raw = await fs.readFile(dataPath(), 'utf8');
    const store = normalizeStore(JSON.parse(raw));
    const errors = validateStore(store);
    if (errors.length) throw new Error(errors.join('\n'));
    return store;
  } catch (error) {
    if (error.code === 'ENOENT') return normalizeStore(null);
    throw error;
  }
}

async function writeStore(store) {
  const normalized = normalizeStore(store);
  const errors = validateStore(normalized);
  if (errors.length) throw new Error(errors.join('\n'));
  await fs.mkdir(app.getPath('userData'), { recursive: true });
  try { await fs.copyFile(dataPath(), backupPath()); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const temp = `${dataPath()}.tmp`;
  await fs.writeFile(temp, JSON.stringify({ ...normalized, updatedAt: new Date().toISOString() }, null, 2), 'utf8');
  await fs.rename(temp, dataPath());
  return normalized;
}

async function saveDialog(defaultName, filters) {
  return dialog.showSaveDialog(mainWindow, { defaultPath: path.join(app.getPath('documents'), defaultName), filters, properties: ['createDirectory'] });
}

function registerIpc() {
  ipcMain.handle('store:load', () => readStore());
  ipcMain.handle('store:save', (_event, store) => writeStore(store));
  ipcMain.handle('store:import', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'], filters: [{ name: 'Tax Ledger backup', extensions: ['json'] }] });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    const raw = await fs.readFile(result.filePaths[0], 'utf8');
    const store = normalizeStore(JSON.parse(raw));
    const errors = validateStore(store);
    if (errors.length) throw new Error(errors.join('\n'));
    return { canceled: false, store };
  });
  ipcMain.handle('store:export-json', async (_event, store) => {
    const result = await saveDialog('tax-ledger-backup.json', [{ name: 'JSON backup', extensions: ['json'] }]);
    if (result.canceled || !result.filePath) return { canceled: true };
    await fs.writeFile(result.filePath, JSON.stringify(normalizeStore(store), null, 2), 'utf8');
    return { canceled: false, path: result.filePath };
  });
  ipcMain.handle('store:export-csv', async (_event, store, year) => {
    const result = await saveDialog(`tax-ledger-${year || 'transactions'}.csv`, [{ name: 'CSV spreadsheet', extensions: ['csv'] }]);
    if (result.canceled || !result.filePath) return { canceled: true };
    await fs.writeFile(result.filePath, serializeCsv(normalizeStore(store), year), 'utf8');
    return { canceled: false, path: result.filePath };
  });
  ipcMain.handle('report:export-pdf', async (_event, store, year) => {
    const result = await saveDialog(`tax-ledger-${year || 'report'}.pdf`, [{ name: 'PDF report', extensions: ['pdf'] }]);
    if (result.canceled || !result.filePath) return { canceled: true };
    const reportWindow = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
    try {
      await reportWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buildReportHtml(normalizeStore(store), year))}`);
      const pdf = await reportWindow.webContents.printToPDF({ landscape: true, pageSize: 'Letter', printBackground: true, margins: { marginType: 'default' } });
      await fs.writeFile(result.filePath, pdf);
    } finally { if (!reportWindow.isDestroyed()) reportWindow.destroy(); }
    return { canceled: false, path: result.filePath };
  });
  ipcMain.handle('app:open-folder', (_event, filePath) => shell.showItemInFolder(filePath));
  ipcMain.handle('app:version', () => app.getVersion());
}

function createWindow() {
  mainWindow = new BrowserWindow({ width: 1440, height: 940, minWidth: 1080, minHeight: 720, backgroundColor: '#eef3f8', title: 'Tax Ledger', icon: path.join(__dirname, 'assets', 'taxman-icon.png'), webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: false } });
  Menu.setApplicationMenu(Menu.buildFromTemplate(createApplicationMenuTemplate(sendMenuAction)));
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.localtaxledger.ledger2025');
  registerIpc();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

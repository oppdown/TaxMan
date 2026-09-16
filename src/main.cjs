'use strict';

const { app, BrowserWindow, dialog, ipcMain, shell, Menu } = require('electron');
const { autoUpdater } = require('electron-updater');
const http = require('node:http');
const os = require('node:os');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const QRCode = require('qrcode');
const { buildReportHtml, normalizeStore, validateStore, serializeCsv } = require('./core.cjs');
const { createApplicationMenuTemplate } = require('./menu.cjs');
const { loadStoreFromFiles } = require('./store-file.cjs');
const { extractBillFields } = require('./ocr.cjs');
const { createWorker } = require('tesseract.js');

const DATA_FILE = 'data.json';
const BACKUP_FILE = 'data.backup.json';
const PAIRING_FILE = 'paired-phone.json';
const PHONE_SERVER_PORT = 38741;
const STABLE_USER_DATA_DIRECTORY = 'TaxMan';
const LEGACY_USER_DATA_DIRECTORIES = ['tax-ledger-2025'];
let mainWindow;
let phoneCaptureServer;
let phoneCaptureSession;
let phonePairingSession;
let pairedPhone;
let phoneServerPort = PHONE_SERVER_PORT;
let updateCheckInProgress = false;
let updatePromptOpen = false;
let ocrWorkerPromise;

function dataPath() { return path.join(app.getPath('userData'), DATA_FILE); }
function backupPath() { return path.join(app.getPath('userData'), BACKUP_FILE); }
function pairingPath() { return path.join(app.getPath('userData'), PAIRING_FILE); }
function legacyDataPaths() { return LEGACY_USER_DATA_DIRECTORIES.flatMap((directory) => [path.join(app.getPath('appData'), directory, DATA_FILE), path.join(app.getPath('appData'), directory, BACKUP_FILE)]); }

function lanAddress() {
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal && !entry.address.startsWith('169.254.')) return entry.address;
    }
  }
  return '127.0.0.1';
}

function jsonResponse(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Length': Buffer.byteLength(body) });
  response.end(body);
}

function mobileCapturePage() {
  return fs.readFile(path.join(__dirname, 'mobile-capture.html'), 'utf8');
}

async function readRequestBody(request, maxBytes = 9000000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw new Error('The photo is too large. Try again with a smaller image.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function publicPairedPhone() {
  if (!pairedPhone) return null;
  return { deviceName: pairedPhone.deviceName, pairedAt: pairedPhone.pairedAt, lastSeenAt: pairedPhone.lastSeenAt || null };
}

async function loadPairedPhone() {
  try {
    const value = JSON.parse(await fs.readFile(pairingPath(), 'utf8'));
    if (value && typeof value.deviceToken === 'string' && typeof value.deviceName === 'string') pairedPhone = value;
  } catch (error) { if (error.code !== 'ENOENT') console.warn('TaxMan could not load the paired phone.', error.message); }
}

async function savePairedPhone() {
  await fs.mkdir(app.getPath('userData'), { recursive: true });
  await fs.writeFile(pairingPath(), JSON.stringify(pairedPhone, null, 2), 'utf8');
}

async function closePhoneServer() {
  const server = phoneCaptureServer;
  phoneCaptureServer = null;
  if (server) await new Promise((resolve) => server.close(() => resolve()));
}

function validImageData(imageData) {
  return typeof imageData === 'string' && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(imageData) && imageData.length <= 12000000;
}

function isPairedRequest(url) {
  return pairedPhone && url.searchParams.get('token') === pairedPhone.deviceToken;
}

async function phoneServerRequest(request, response) {
  const url = new URL(request.url || '/', 'http://localhost');
  if (request.method === 'OPTIONS') { response.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' }); response.end(); return; }
  if (request.method === 'POST' && url.pathname === '/pair') {
    try {
      const payload = JSON.parse(await readRequestBody(request, 100000));
      const code = String(payload.code || '').replace(/\D/g, '');
      if (!phonePairingSession || Date.now() > phonePairingSession.expiresAt || code !== phonePairingSession.code) throw new Error('That pairing code has expired or is incorrect. Start pairing again on the PC.');
      const deviceName = String(payload.deviceName || 'Android phone').trim().slice(0, 80) || 'Android phone';
      pairedPhone = { deviceName, deviceToken: crypto.randomBytes(24).toString('hex'), pairedAt: new Date().toISOString(), lastSeenAt: null };
      phonePairingSession = null;
      await savePairedPhone();
      jsonResponse(response, 200, { ok: true, computerName: 'TaxMan on this PC', baseUrl: `http://${lanAddress()}:${phoneServerPort}`, token: pairedPhone.deviceToken, deviceName });
    } catch (error) { jsonResponse(response, 400, { ok: false, error: error.message }); }
    return;
  }
  if (request.method === 'GET' && url.pathname === '/pair') {
    response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end('Open TaxMan on your phone, choose Pair with PC, and enter the one-time code shown on this computer.');
    return;
  }
  if (request.method === 'GET' && url.pathname === '/paired/poll') {
    if (!isPairedRequest(url)) { jsonResponse(response, 403, { ok: false, error: 'This phone is not paired with TaxMan.' }); return; }
    pairedPhone.lastSeenAt = new Date().toISOString();
    const active = phoneCaptureSession && phoneCaptureSession.pairedToken === pairedPhone.deviceToken && Date.now() <= phoneCaptureSession.expiresAt;
    jsonResponse(response, 200, { ok: true, computerName: 'TaxMan on this PC', captureAvailable: Boolean(active), expiresAt: active ? phoneCaptureSession.expiresAt : null });
    return;
  }
  if (request.method === 'POST' && url.pathname === '/paired/upload') {
    if (!isPairedRequest(url)) { jsonResponse(response, 403, { ok: false, error: 'This phone is not paired with TaxMan.' }); return; }
    try {
      const payload = JSON.parse(await readRequestBody(request));
      if (!phoneCaptureSession || phoneCaptureSession.pairedToken !== pairedPhone.deviceToken || Date.now() > phoneCaptureSession.expiresAt) throw new Error('TaxMan is not currently waiting for a photo. Start capture on the PC first.');
      if (!validImageData(payload.imageData)) throw new Error('The photo could not be read. Please try again with a smaller image.');
      phoneCaptureSession.imageData = payload.imageData;
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('phone-capture:uploaded', payload.imageData);
      jsonResponse(response, 200, { ok: true });
    } catch (error) { jsonResponse(response, 400, { ok: false, error: error.message }); }
    return;
  }
  if (request.method === 'GET' && url.pathname === '/capture') {
    if (!phoneCaptureSession || phoneCaptureSession.token !== url.searchParams.get('token') || phoneCaptureSession.pairedToken || Date.now() > phoneCaptureSession.expiresAt) {
      response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end('This TaxMan phone capture link has expired.');
      return;
    }
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(await mobileCapturePage());
    return;
  }
  if (request.method === 'POST' && url.pathname === '/upload') {
    if (!phoneCaptureSession || phoneCaptureSession.token !== url.searchParams.get('token') || phoneCaptureSession.pairedToken || Date.now() > phoneCaptureSession.expiresAt) { jsonResponse(response, 403, { ok: false, error: 'This TaxMan phone capture link has expired.' }); return; }
    try {
      const payload = JSON.parse(await readRequestBody(request));
      if (!validImageData(payload.imageData)) throw new Error('The photo could not be read. Please try again with a smaller image.');
      phoneCaptureSession.imageData = payload.imageData;
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('phone-capture:uploaded', payload.imageData);
      jsonResponse(response, 200, { ok: true });
    } catch (error) { jsonResponse(response, 400, { ok: false, error: error.message }); }
    return;
  }
  response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end('Not found');
}

async function ensurePhoneServer() {
  if (phoneCaptureServer) return;
  phoneCaptureServer = http.createServer((request, response) => { phoneServerRequest(request, response).catch((error) => jsonResponse(response, 500, { ok: false, error: error.message || 'TaxMan phone service error.' })); });
  try {
    await new Promise((resolve, reject) => { phoneCaptureServer.once('error', reject); phoneCaptureServer.listen(PHONE_SERVER_PORT, '0.0.0.0', resolve); });
    phoneServerPort = phoneCaptureServer.address().port;
  } catch (error) { await closePhoneServer(); if (error.code === 'EADDRINUSE') throw new Error(`TaxMan could not start its phone service because port ${PHONE_SERVER_PORT} is already in use.`); throw error; }
}

async function stopPhoneCapture() {
  phoneCaptureSession = null;
  if (!pairedPhone && !phonePairingSession) await closePhoneServer();
}

async function startPhonePairing() {
  await ensurePhoneServer();
  phonePairingSession = { code: String(Math.floor(100000 + Math.random() * 900000)), expiresAt: Date.now() + 10 * 60 * 1000 };
  const url = `http://${lanAddress()}:${phoneServerPort}/pair?code=${phonePairingSession.code}`;
  const qrDataUrl = await QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 2, width: 240 });
  return { code: phonePairingSession.code, url, qrDataUrl, expiresAt: phonePairingSession.expiresAt };
}

async function startPhoneCapture() {
  await stopPhoneCapture();
  await ensurePhoneServer();
  const token = crypto.randomBytes(18).toString('hex');
  phoneCaptureSession = { token, pairedToken: pairedPhone?.deviceToken || '', imageData: '', expiresAt: Date.now() + 10 * 60 * 1000 };
  if (pairedPhone) return { paired: true, deviceName: pairedPhone.deviceName, expiresAt: phoneCaptureSession.expiresAt };
  const url = `http://${lanAddress()}:${phoneServerPort}/capture?token=${token}`;
  try {
    const qrDataUrl = await QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 2, width: 240 });
    return { url, qrDataUrl, expiresAt: phoneCaptureSession.expiresAt };
  } catch (error) { await stopPhoneCapture(); throw error; }
}

function sendMenuAction(action) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('menu:action', action);
}

function sendUpdateStatus(status, message, details = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('app:update-status', { status, message, ...details });
}

function configureAutoUpdater() {
  if (process.platform !== 'win32') return;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => sendUpdateStatus('checking', 'Checking for a TaxMan update…'));
  autoUpdater.on('update-not-available', () => sendUpdateStatus('not-available', 'TaxMan is up to date.'));
  autoUpdater.on('update-available', async (info) => {
    sendUpdateStatus('available', `TaxMan ${info.version} is available.`, { version: info.version });
    if (updatePromptOpen || !mainWindow || mainWindow.isDestroyed()) return;
    updatePromptOpen = true;
    try {
      const choice = await dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'TaxMan update available',
        message: `TaxMan ${info.version} is ready to download.`,
        detail: 'TaxMan will download the update and ask before restarting. Your local records will remain in place.',
        buttons: ['Download update', 'Later'],
        defaultId: 0,
        cancelId: 1
      });
      if (choice.response === 0) {
        sendUpdateStatus('downloading', 'Downloading the TaxMan update…');
        await autoUpdater.downloadUpdate();
      } else sendUpdateStatus('available', `TaxMan ${info.version} is available whenever you are ready.`, { version: info.version });
    } catch (error) {
      sendUpdateStatus('error', error.message || 'The TaxMan update could not be downloaded.');
    } finally { updatePromptOpen = false; }
  });
  autoUpdater.on('download-progress', (progress) => sendUpdateStatus('downloading', `Downloading the TaxMan update… ${Math.round(progress.percent)}%`));
  autoUpdater.on('update-downloaded', async (info) => {
    sendUpdateStatus('downloaded', `TaxMan ${info.version} is ready to install.`, { version: info.version });
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const choice = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'TaxMan update ready',
      message: `TaxMan ${info.version} has been downloaded.`,
      detail: 'Restart TaxMan now to finish installing the update, or choose Later and install it the next time you close the app.',
      buttons: ['Restart and install', 'Later'],
      defaultId: 0,
      cancelId: 1
    });
    if (choice.response === 0) autoUpdater.quitAndInstall();
  });
  autoUpdater.on('error', (error) => sendUpdateStatus('error', error.message || 'TaxMan could not check for updates.'));
}

async function checkForUpdates() {
  if (!app.isPackaged || process.platform !== 'win32') return { status: 'unavailable', message: 'Automatic updates are available in the installed Windows version of TaxMan.' };
  if (updateCheckInProgress) return { status: 'checking', message: 'TaxMan is already checking for updates.' };
  updateCheckInProgress = true;
  try {
    await autoUpdater.checkForUpdates();
    return { status: 'checking', message: 'Checking for a TaxMan update…' };
  } catch (error) {
    const message = error.message || 'TaxMan could not check for updates.';
    sendUpdateStatus('error', message);
    return { status: 'error', message };
  } finally { updateCheckInProgress = false; }
}

async function readBillPhoto(imageData, store) {
  if (typeof imageData !== 'string' || !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(imageData) || imageData.length > 12000000) throw new Error('The bill photo could not be read.');
  if (!ocrWorkerPromise) ocrWorkerPromise = createWorker('eng', 1, { logger: () => {} });
  let worker;
  try {
    worker = await ocrWorkerPromise;
    const result = await worker.recognize(imageData);
    return extractBillFields(result.data.text, store);
  } catch (error) {
    ocrWorkerPromise = null;
    throw new Error(error.message || 'TaxMan could not read the bill photo.');
  }
}

async function readStore() {
  const store = await loadStoreFromFiles({
    currentPath: dataPath(),
    fallbackPaths: [backupPath(), ...legacyDataPaths()],
    normalizeStore,
    validateStore,
    migrate: (legacyStore) => writeStore(legacyStore)
  });
  return store || normalizeStore(null);
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
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'], filters: [{ name: 'TaxMan backup', extensions: ['json'] }] });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    const raw = await fs.readFile(result.filePaths[0], 'utf8');
    const store = normalizeStore(JSON.parse(raw));
    const errors = validateStore(store);
    if (errors.length) throw new Error(errors.join('\n'));
    return { canceled: false, store };
  });
  ipcMain.handle('store:export-json', async (_event, store) => {
    const result = await saveDialog('taxman-backup.json', [{ name: 'JSON backup', extensions: ['json'] }]);
    if (result.canceled || !result.filePath) return { canceled: true };
    await fs.writeFile(result.filePath, JSON.stringify(normalizeStore(store), null, 2), 'utf8');
    return { canceled: false, path: result.filePath };
  });
  ipcMain.handle('store:export-csv', async (_event, store, year) => {
    const result = await saveDialog(`taxman-${year || 'transactions'}.csv`, [{ name: 'CSV spreadsheet', extensions: ['csv'] }]);
    if (result.canceled || !result.filePath) return { canceled: true };
    await fs.writeFile(result.filePath, serializeCsv(normalizeStore(store), year), 'utf8');
    return { canceled: false, path: result.filePath };
  });
  ipcMain.handle('report:export-pdf', async (_event, store, year) => {
    const result = await saveDialog(`taxman-${year || 'report'}.pdf`, [{ name: 'PDF report', extensions: ['pdf'] }]);
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
  ipcMain.handle('app:check-for-updates', () => checkForUpdates());
  ipcMain.handle('app:version', () => app.getVersion());
  ipcMain.handle('phone-capture:start', () => startPhoneCapture());
  ipcMain.handle('phone-capture:stop', () => stopPhoneCapture());
  ipcMain.handle('phone-pairing:start', () => startPhonePairing());
  ipcMain.handle('phone-pairing:get', () => publicPairedPhone());
  ipcMain.handle('phone-pairing:remove', async () => { pairedPhone = null; phonePairingSession = null; await fs.rm(pairingPath(), { force: true }); if (!phoneCaptureSession) await closePhoneServer(); return { removed: true }; });
  ipcMain.handle('ocr:bill', (_event, imageData, store) => readBillPhoto(imageData, store));
}

function createWindow() {
  mainWindow = new BrowserWindow({ width: 1440, height: 940, minWidth: 1080, minHeight: 720, backgroundColor: '#eef3f8', title: 'TaxMan', icon: path.join(__dirname, 'assets', 'taxman-icon.png'), webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: false } });
  Menu.setApplicationMenu(Menu.buildFromTemplate(createApplicationMenuTemplate(sendMenuAction)));
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(async () => {
  app.setPath('userData', path.join(app.getPath('appData'), STABLE_USER_DATA_DIRECTORY));
  app.setAppUserModelId('com.localtaxledger.ledger2025');
  await loadPairedPhone();
  registerIpc();
  createWindow();
  configureAutoUpdater();
  if (pairedPhone) ensurePhoneServer().catch((error) => console.warn(error.message));
});
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { if (phoneCaptureServer) phoneCaptureServer.close(); if (ocrWorkerPromise) ocrWorkerPromise.then((worker) => worker?.terminate()).catch(() => {}); });

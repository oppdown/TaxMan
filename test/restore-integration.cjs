'use strict';

const assert = require('node:assert/strict');
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createEmptyStore, normalizeStore, validateStore } = require('../src/core.cjs');

const runtimeDir = path.join(__dirname, '.restore-runtime');
const dataFile = path.join(runtimeDir, 'data.json');
const backupFile = path.join(runtimeDir, 'backup.json');
app.on('window-all-closed', (event) => event.preventDefault());

function waitForRender() { return new Promise((resolve) => setTimeout(resolve, 45)); }

async function createRuntimeFiles() {
  await fs.rm(runtimeDir, { recursive: true, force: true });
  await fs.mkdir(runtimeDir, { recursive: true });
  const backup = createEmptyStore();
  backup.taxYear = 2025;
  backup.transactions.push({
    id: 'integration-restored-income',
    taxYear: 2026,
    date: '2026-09-08',
    type: 'income',
    companyId: 'company-theitsupportcenter',
    categoryId: 'income-freelance',
    description: 'Integration restored income',
    amountCents: 65400,
    businessUsePercent: null,
    homeOfficeRelated: false,
    notes: 'Read from JSON backup',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  await fs.writeFile(backupFile, JSON.stringify(backup, null, 2), 'utf8');
}

function preloadPath() {
  const preload = path.join(__dirname, '.restore-integration-preload.cjs');
  return preload;
}

async function openRestoreWindow() {
  const window = new BrowserWindow({ show: false, webPreferences: { preload: preloadPath(), contextIsolation: true, nodeIntegration: false, sandbox: false } });
  await window.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  return window;
}

async function main() {
  await createRuntimeFiles();
  const firstWindow = await openRestoreWindow();
  await waitForRender();
  const firstResult = await firstWindow.webContents.executeJavaScript(`(async () => {
    let phase = 'start';
    const wait = () => new Promise((resolve) => setTimeout(resolve, 60));
    try {
      window.confirm = () => true;
      phase = 'reports';
      document.querySelector('[data-view="reports"]').click();
      await wait();
      phase = 'restore';
      document.querySelector('[data-action="restore-json"]').click();
      await wait();
      phase = 'transactions';
      document.querySelector('[data-view="transactions"]').click();
      await wait();
      return { year: document.getElementById('year-select')?.value, body: document.body.textContent, phase };
    } catch (error) { return { error: error.message, phase }; }
  })()`);
  assert.equal(firstResult.year, '2026');
  assert.match(firstResult.body, /Integration restored income/);
  assert.match(firstResult.body, /\$654\.00/);
  await firstWindow.close();

  const saved = normalizeStore(JSON.parse(await fs.readFile(dataFile, 'utf8')));
  assert.equal(validateStore(saved).length, 0);
  assert.equal(saved.transactions[0].description, 'Integration restored income');

  const secondWindow = await openRestoreWindow();
  const secondResult = await secondWindow.webContents.executeJavaScript(`(async () => {
    const wait = () => new Promise((resolve) => setTimeout(resolve, 60));
    document.querySelector('[data-view="transactions"]').click();
    await wait();
    return { year: document.getElementById('year-select')?.value, body: document.body.textContent };
  })()`);
  assert.equal(secondResult.year, '2026');
  assert.match(secondResult.body, /Integration restored income/);
  await secondWindow.close();
  await fs.rm(runtimeDir, { recursive: true, force: true });
  console.log(JSON.stringify({ restoredVisible: true, restoredAfterRestart: true, selectedYear: '2026' }));
  app.quit();
}

app.whenReady().then(main).catch((error) => { console.error(error); app.exit(1); });

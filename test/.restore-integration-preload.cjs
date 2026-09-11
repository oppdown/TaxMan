'use strict';

const { contextBridge } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createEmptyStore, normalizeStore, validateStore } = require('../src/core.cjs');

const runtimeDir = path.join(__dirname, '.restore-runtime');
const dataFile = path.join(runtimeDir, 'data.json');
const backupFile = path.join(runtimeDir, 'backup.json');

async function readJson(filePath, fallback) {
  try { return JSON.parse(await fs.readFile(filePath, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}

let menuActionCallback;
contextBridge.exposeInMainWorld('taxLedger', {
  loadStore: async () => normalizeStore(await readJson(dataFile, createEmptyStore())),
  saveStore: async (store) => {
    const normalized = normalizeStore(store);
    const errors = validateStore(normalized);
    if (errors.length) throw new Error(errors.join('\n'));
    await fs.writeFile(dataFile, JSON.stringify(normalized, null, 2), 'utf8');
    return normalized;
  },
  importJson: async () => ({ canceled: false, store: normalizeStore(await readJson(backupFile, null)) }),
  exportJson: async () => ({ canceled: true }),
  exportCsv: async () => ({ canceled: true }),
  exportPdf: async () => ({ canceled: true }),
  openFolder: async () => {},
  getVersion: async () => '0.2.5',
  onMenuAction: (callback) => { menuActionCallback = callback; },
  testEmitMenuAction: async (action) => menuActionCallback?.(action)
});

'use strict';

const { contextBridge } = require('electron');
const { createEmptyStore } = require('../src/core.cjs');

let testStore = createEmptyStore();

contextBridge.exposeInMainWorld('taxLedger', {
  loadStore: async () => testStore,
  saveStore: async (store) => { testStore = store; return store; },
  importJson: async () => ({ canceled: true }),
  exportJson: async () => ({ canceled: false, path: 'test-backup.json' }),
  exportCsv: async () => ({ canceled: false, path: 'test-ledger.csv' }),
  exportPdf: async () => ({ canceled: false, path: 'test-report.pdf' }),
  openFolder: async () => {},
  getVersion: async () => '0.2.1'
});

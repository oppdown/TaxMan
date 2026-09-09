'use strict';

const { contextBridge } = require('electron');
const { createEmptyStore } = require('../src/core.cjs');

let testStore = createEmptyStore();
const restoredStore = createEmptyStore();
restoredStore.transactions.push({ id: 'restored-income', taxYear: 2025, date: '2025-12-31', type: 'income', companyId: 'company-theitsupportcenter', categoryId: 'income-freelance', description: 'Restored income', amountCents: 32100, businessUsePercent: null, homeOfficeRelated: false, notes: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });

contextBridge.exposeInMainWorld('taxLedger', {
  loadStore: async () => testStore,
  saveStore: async (store) => { testStore = store; return store; },
  importJson: async () => ({ canceled: false, store: restoredStore }),
  exportJson: async () => ({ canceled: false, path: 'test-backup.json' }),
  exportCsv: async () => ({ canceled: false, path: 'test-ledger.csv' }),
  exportPdf: async () => ({ canceled: false, path: 'test-report.pdf' }),
  openFolder: async () => {},
  getVersion: async () => '0.2.2'
});

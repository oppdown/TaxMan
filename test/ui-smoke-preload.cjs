'use strict';

const { contextBridge } = require('electron');
const { createEmptyStore } = require('../src/core.cjs');

let testStore = createEmptyStore();
const restoredStore = createEmptyStore();
restoredStore.taxYear = 2025;
restoredStore.transactions.push({ id: 'restored-income', taxYear: 2026, date: '2026-09-08', type: 'income', companyId: 'company-theitsupportcenter', categoryId: 'income-freelance', description: 'Restored income', amountCents: 32100, businessUsePercent: null, homeOfficeRelated: false, notes: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
let menuActionCallback;

contextBridge.exposeInMainWorld('taxLedger', {
  supportsPhoneCapture: true,
  supportsOcr: true,
  loadStore: async () => testStore,
  saveStore: async (store) => { testStore = store; return store; },
  importJson: async () => ({ canceled: false, store: restoredStore }),
  exportJson: async () => ({ canceled: false, path: 'test-backup.json' }),
  exportCsv: async () => ({ canceled: false, path: 'test-ledger.csv' }),
  exportPdf: async () => ({ canceled: false, path: 'test-report.pdf' }),
  openFolder: async () => {},
  checkForUpdates: async () => ({ status: 'unavailable', message: 'Automatic updates are available in the installed Windows version of TaxMan.' }),
  readBillPhoto: async () => ({ date: '2026-09-16', companyId: 'company-theitsupportcenter', categoryId: 'expense-other', description: 'Smoke bill', amountCents: 1234, text: 'Smoke Company\n09/16/2026\nTOTAL $12.34' }),
  getVersion: async () => '0.4.1',
  onMenuAction: (callback) => { menuActionCallback = callback; },
  testEmitMenuAction: async (action) => menuActionCallback?.(action)
});

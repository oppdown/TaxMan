'use strict';

const { contextBridge } = require('electron');
const { createEmptyStore } = require('../src/core.cjs');

let testStore = createEmptyStore();
const restoredStore = createEmptyStore();
restoredStore.taxYear = 2025;
restoredStore.transactions.push({ id: 'restored-income', taxYear: 2026, date: '2026-09-08', type: 'income', companyId: 'company-theitsupportcenter', categoryId: 'income-freelance', description: 'Restored income', amountCents: 32100, businessUsePercent: null, homeOfficeRelated: false, notes: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
let menuActionCallback;
const workspaceState = { configured: true, available: true, path: 'test-workspace', storage: { currentBytes: 4096, recoveryBytes: 2048, backupFolderBytes: 1024, backupFileCount: 1, workspaceBytes: 7168 }, storageSettings: { closeBehavior: 'ask', backupRetention: 7, backupReminderDays: 30, lastManualBackupAt: '' } };

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
  startPhoneCapture: async () => ({ url: 'http://127.0.0.1:38741/capture?token=smoke', qrDataUrl: '', expiresAt: Date.now() + 600000 }),
  stopPhoneCapture: async () => {},
  getWorkspace: async () => workspaceState,
  refreshWorkspace: async () => workspaceState,
  setStorageSettings: async (settings) => { workspaceState.storageSettings = { ...workspaceState.storageSettings, ...settings }; return workspaceState; },
  chooseWorkspace: async () => ({ canceled: true }),
  getVersion: async () => '0.4.16',
  onMenuAction: (callback) => { menuActionCallback = callback; },
  testEmitMenuAction: async (action) => menuActionCallback?.(action)
});

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { loadStoreFromFiles } = require('../src/store-file.cjs');
const { createEmptyStore, normalizeStore, validateStore } = require('../src/core.cjs');

test('loads the current store without migration', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'taxman-store-'));
  const currentPath = path.join(root, 'current', 'data.json');
  const fallbackPath = path.join(root, 'legacy', 'data.json');
  const store = createEmptyStore();
  store.transactions.push({ id: 'current-entry', taxYear: 2026, date: '2026-09-16', type: 'income', companyId: 'company-theitsupportcenter', categoryId: 'income-freelance', description: 'Current entry', amountCents: 100, businessUsePercent: null, homeOfficeRelated: false, notes: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  await fs.mkdir(path.dirname(currentPath), { recursive: true });
  await fs.writeFile(currentPath, JSON.stringify(store));

  let migrated = false;
  const loaded = await loadStoreFromFiles({ currentPath, fallbackPaths: [fallbackPath], normalizeStore, validateStore, migrate: async () => { migrated = true; } });
  assert.equal(loaded.transactions[0].id, 'current-entry');
  assert.equal(migrated, false);
});

test('loads a legacy store and migrates it when the current file is absent', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'taxman-store-'));
  const currentPath = path.join(root, 'current', 'data.json');
  const legacyPath = path.join(root, 'legacy', 'data.json');
  const store = createEmptyStore();
  store.transactions.push({ id: 'legacy-entry', taxYear: 2026, date: '2026-09-16', type: 'expense', companyId: 'company-hart-emc', categoryId: 'expense-utilities', description: 'Legacy entry', amountCents: 1250, businessUsePercent: 100, homeOfficeRelated: false, notes: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  await fs.mkdir(path.dirname(legacyPath), { recursive: true });
  await fs.writeFile(legacyPath, JSON.stringify(store));

  let migratedStore;
  let migratedFrom;
  const loaded = await loadStoreFromFiles({ currentPath, fallbackPaths: [legacyPath], normalizeStore, validateStore, migrate: async (value, sourcePath) => { migratedStore = value; migratedFrom = sourcePath; } });
  assert.equal(loaded.transactions[0].id, 'legacy-entry');
  assert.equal(migratedStore.transactions[0].id, 'legacy-entry');
  assert.equal(migratedFrom, legacyPath);
});

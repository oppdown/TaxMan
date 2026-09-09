'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createEmptyStore, normalizeStore, validateStore, calculateSummary, businessAmountCents, serializeCsv, buildReportHtml } = require('../src/core.cjs');

function sampleStore() {
  const store = createEmptyStore();
  store.companies = [
    { id: 'power', name: 'Georgia Power', classification: 'Utility', phone: '', email: '', website: '', notes: '' },
    { id: 'client', name: 'Example Client', classification: 'Income source', phone: '', email: '', website: '', notes: '' }
  ];
  store.transactions = [
    { id: 'income-1', taxYear: 2025, date: '2025-02-01', type: 'income', companyId: 'client', categoryId: 'income-freelance', description: 'January project', amountCents: 100000, businessUsePercent: null, homeOfficeRelated: false, notes: '', createdAt: '2025-01-01', updatedAt: '2025-01-01' },
    { id: 'expense-1', taxYear: 2025, date: '2025-02-03', type: 'expense', companyId: 'power', categoryId: 'expense-home-office', description: 'Electric bill', amountCents: 12000, businessUsePercent: 25, homeOfficeRelated: true, notes: '', createdAt: '2025-01-01', updatedAt: '2025-01-01' }
  ];
  return store;
}

test('empty store is a valid 2025 ledger', () => {
  const store = createEmptyStore();
  assert.equal(store.taxYear, 2025);
  assert.ok(store.companies.some((company) => company.name === 'Hart EMC'));
  assert.ok(store.companies.some((company) => company.name === 'theITSupportCenter'));
  assert.ok(store.categories.some((category) => category.name === 'Banking Costs'));
  assert.deepEqual(validateStore(store), []);
});

test('business allocation uses integer cents and rounds once', () => {
  assert.equal(businessAmountCents({ type: 'expense', amountCents: 999, businessUsePercent: 33.33 }), 333);
  assert.equal(businessAmountCents({ type: 'income', amountCents: 999, businessUsePercent: null }), 0);
});

test('summary separates income, total expenses, allocated expenses, and home office', () => {
  const summary = calculateSummary(sampleStore());
  assert.equal(summary.incomeCents, 100000);
  assert.equal(summary.expenseCents, 12000);
  assert.equal(summary.allocatedExpenseCents, 3000);
  assert.equal(summary.homeOfficeCents, 12000);
  assert.equal(summary.homeOfficeAllocatedCents, 3000);
  assert.equal(summary.netBeforeTaxCents, 88000);
});

test('normalization accepts valid dates in other years and derives tax year', () => {
  const store = normalizeStore({ taxYear: 2026, companies: [{ id: 'c', name: 'Company' }], transactions: [{ id: 't', date: '2026-09-08', type: 'income', companyId: 'c', categoryId: 'income-other', amountCents: 100 }] });
  assert.equal(store.transactions[0].taxYear, 2026);
  assert.deepEqual(validateStore(store), []);
  assert.equal(calculateSummary(store, 2026).incomeCents, 100);
  assert.equal(calculateSummary(store, 2025).incomeCents, 0);
});

test('validation rejects impossible calendar dates', () => {
  const store = normalizeStore({ companies: [{ id: 'c', name: 'Company' }], transactions: [{ id: 't', date: '2025-02-31', type: 'income', companyId: 'c', categoryId: 'income-other', amountCents: 100 }] });
  assert.ok(validateStore(store).some((error) => error.includes('Invalid transaction date')));
});

test('CSV and PDF report include the combined type column and preparer note', () => {
  const store = sampleStore();
  const csv = serializeCsv(store);
  const html = buildReportHtml(store);
  assert.match(csv, /Income\/Expense/);
  assert.match(csv, /Georgia Power/);
  assert.match(html, /Income\/Expense/);
  assert.match(html, /Final tax treatment/);
});

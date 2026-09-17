'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createEmptyStore, normalizeStore, validateStore, calculateSummary, businessAmountCents, calculateTimeBusinessUsePercent, serializeCsv, buildReportHtml, isReceiptImageData } = require('../src/core.cjs');

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
  assert.deepEqual(store.workTime, { hoursPerDay: 8, daysPerWeek: 7 });
  assert.ok(store.companies.some((company) => company.name === 'Hart EMC'));
  assert.ok(store.companies.some((company) => company.name === 'theITSupportCenter'));
  assert.ok(store.categories.some((category) => category.name === 'Banking Costs'));
  assert.deepEqual(validateStore(store), []);
});

test('time-based business use calculates 33.33% for eight hours across seven days', () => {
  assert.equal(calculateTimeBusinessUsePercent({ hoursPerDay: 8, daysPerWeek: 7 }), 33.33);
  assert.equal(calculateTimeBusinessUsePercent({ hoursPerDay: 4, daysPerWeek: 5 }), 11.9);
  assert.deepEqual(normalizeStore({ workTime: { hoursPerDay: 9, daysPerWeek: 6 } }).workTime, { hoursPerDay: 9, daysPerWeek: 6 });
});

test('company home-office preference survives normalization', () => {
  const store = normalizeStore({ companies: [{ id: 'power', name: 'Georgia Power', alwaysHomeOfficeRelated: true }] });
  assert.equal(store.companies[0].alwaysHomeOfficeRelated, true);
  assert.deepEqual(validateStore(store), []);
});

test('company mailing address fields survive normalization', () => {
  const store = normalizeStore({ companies: [{ id: 'power', name: 'Georgia Power', mailingAddress1: 'P.O. Box 123', mailingCity: 'Atlanta', mailingState: 'GA', mailingPostalCode: '30301' }] });
  assert.equal(store.companies[0].mailingAddress1, 'P.O. Box 123');
  assert.equal(store.companies[0].mailingCity, 'Atlanta');
  assert.equal(store.companies[0].mailingState, 'GA');
  assert.equal(store.companies[0].mailingPostalCode, '30301');
  assert.equal(store.companies[0].mailingAddress2, '');
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

test('receipt photos normalize and survive local store validation', () => {
  const image = `data:image/jpeg;base64,${Buffer.from('bill-photo').toString('base64')}`;
  const store = normalizeStore({ companies: [{ id: 'c', name: 'Company' }], transactions: [{ id: 't', date: '2026-09-08', type: 'expense', companyId: 'c', categoryId: 'expense-other', description: 'Bill', amountCents: 1250, businessUsePercent: 100, receiptImageData: image }] });
  assert.equal(isReceiptImageData(image), true);
  assert.equal(store.transactions[0].receiptImageData, image);
  assert.deepEqual(store.transactions[0].receiptImages, [image]);
  assert.deepEqual(validateStore(store), []);
});

test('multiple bill-photo pages normalize and preserve the first page compatibility field', () => {
  const first = `data:image/jpeg;base64,${Buffer.from('first').toString('base64')}`;
  const second = `data:image/jpeg;base64,${Buffer.from('second').toString('base64')}`;
  const store = normalizeStore({ companies: [{ id: 'c', name: 'Company' }], transactions: [{ id: 't', date: '2026-09-08', type: 'expense', companyId: 'c', categoryId: 'expense-other', description: 'Bill', amountCents: 1250, businessUsePercent: 100, receiptImages: [first, second] }] });
  assert.deepEqual(store.transactions[0].receiptImages, [first, second]);
  assert.equal(store.transactions[0].receiptImageData, first);
});

test('paid date normalizes, persists, and validates independently from bill date', () => {
  const store = normalizeStore({ companies: [{ id: 'c', name: 'Company' }], transactions: [{ id: 't', date: '2026-05-17', paidDate: '2026-05-20', type: 'expense', companyId: 'c', categoryId: 'expense-other', description: 'Bill', amountCents: 1250, businessUsePercent: 100 }] });
  assert.equal(store.transactions[0].date, '2026-05-17');
  assert.equal(store.transactions[0].paidDate, '2026-05-20');
  assert.deepEqual(validateStore(store), []);
});

test('validation rejects an invalid paid date', () => {
  const store = normalizeStore({ companies: [{ id: 'c', name: 'Company' }], transactions: [{ id: 't', date: '2026-05-17', paidDate: '2026-02-31', type: 'expense', companyId: 'c', categoryId: 'expense-other', description: 'Bill', amountCents: 1250, businessUsePercent: 100 }] });
  assert.ok(validateStore(store).some((error) => error.includes('Invalid paid date')));
});

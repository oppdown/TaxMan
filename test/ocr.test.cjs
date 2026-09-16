'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createEmptyStore } = require('../src/core.cjs');
const { extractBillFields } = require('../src/ocr.cjs');

test('bill OCR parser extracts reviewable fields and matches known companies', () => {
  const store = createEmptyStore();
  const result = extractBillFields('Hart EMC\nStatement\n09/08/2026\nElectric service\nAmount Due $123.45', store);
  assert.equal(result.date, '2026-09-08');
  assert.equal(result.companyId, 'company-hart-emc');
  assert.equal(result.vendor, 'Hart EMC');
  assert.equal(result.amountCents, 12345);
  assert.equal(result.description, 'Hart EMC bill');
  assert.equal(result.categoryId, 'expense-utilities');
});

test('bill OCR parser leaves unknown vendors for user review', () => {
  const result = extractBillFields('New Vendor\nInvoice\nJanuary 3, 2026\nTotal $9.99');
  assert.equal(result.date, '2026-01-03');
  assert.equal(result.companyId, '');
  assert.equal(result.vendor, 'New Vendor');
  assert.equal(result.amountCents, 999);
});

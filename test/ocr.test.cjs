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
  assert.equal(result.description, '');
  assert.equal(result.categoryId, 'expense-utilities');
});

test('bill OCR parser leaves unknown vendors for user review', () => {
  const result = extractBillFields('New Vendor\nInvoice\nJanuary 3, 2026\nTotal $9.99');
  assert.equal(result.date, '2026-01-03');
  assert.equal(result.companyId, '');
  assert.equal(result.vendor, 'New Vendor');
  assert.equal(result.amountCents, 999);
});

test('bill OCR prefers due date over previous payment date', () => {
  const result = extractBillFields('Hart EMC\n04/17/26 Previous payment\nDUE DATE 05/17/26\nAmount Due $88.00');
  assert.equal(result.date, '2026-05-17');
});

test('bill OCR handles compact due dates and ignores compact previous-payment dates', () => {
  const result = extractBillFields('Electric Provider\n041726 Previous payment\nDue Date\n051726\nTotal $42.00');
  assert.equal(result.date, '2026-05-17');
});

test('bill OCR does not use a previous payment as the bill date when no due date is present', () => {
  const result = extractBillFields('Electric Provider\n041726 Previous payment\nAmount Due $42.00');
  assert.equal(result.date, '');
});

test('bill OCR does not promote noisy numeric text into the company or description', () => {
  const result = extractBillFields('he YR Fd 9 RE\nAmount Due $42.00');
  assert.equal(result.vendor, '');
  assert.equal(result.companyId, '');
  assert.equal(result.description, '');
});

test('bill OCR ignores generic bill wording instead of inventing a description', () => {
  const result = extractBillFields('Yea eh bill\nAmount Due $42.00');
  assert.equal(result.vendor, '');
  assert.equal(result.description, '');
});

test('bill OCR recognizes a known company with small OCR word errors', () => {
  const store = { companies: [{ id: 'company-power', name: 'Georgia Power' }], categories: [] };
  const result = extractBillFields('Georgia Poweer\nAmount Due $42.00', store);
  assert.equal(result.vendor, 'Georgia Power');
  assert.equal(result.companyId, 'company-power');
});

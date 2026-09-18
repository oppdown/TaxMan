'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { UPDATE_CODES, describeUpdateError } = require('../src/update-errors.cjs');

test('missing updater configuration gets a clear actionable code', () => {
  const result = describeUpdateError({ code: 'ENOENT', message: "no such file or directory, open 'C:\\\\TaxMan\\\\resources\\\\app-update.yml'" });
  assert.equal(result.code, UPDATE_CODES.missingConfig);
  assert.match(result.message, /TAXMAN-UPDATE-001/);
  assert.match(result.message, /Reinstall the latest Windows version/);
});

test('network updater errors get a retryable code without exposing raw paths', () => {
  const result = describeUpdateError({ code: 'ETIMEDOUT', message: 'request timed out' });
  assert.equal(result.code, UPDATE_CODES.network);
  assert.match(result.message, /TAXMAN-UPDATE-003/);
  assert.doesNotMatch(result.message, /request timed out/);
});

test('unknown updater errors retain a stable support code', () => {
  const result = describeUpdateError({ code: 'E_UNKNOWN', message: 'unexpected updater failure' });
  assert.equal(result.code, UPDATE_CODES.unknown);
  assert.match(result.message, /TAXMAN-UPDATE-099/);
  assert.doesNotMatch(result.message, /unexpected updater failure/);
});

'use strict';

const assert = require('node:assert/strict');
const { app, BrowserWindow } = require('electron');
const testPort = Number(process.env.TAXMAN_PHONE_PORT) || 38742;
process.env.TAXMAN_PHONE_PORT = String(testPort);
require('../src/main.cjs');

function wait(ms = 250) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function main() {
  await wait();
  const window = BrowserWindow.getAllWindows()[0];
  if (!window) throw new Error('TaxMan window did not start');
  const pairing = await window.webContents.executeJavaScript(`(async () => { await window.taxLedger.unpairPhone(); return window.taxLedger.startPhonePairing(); })()`);
  assert.match(pairing.qrDataUrl, /^data:image\/png;base64,/);
  const response = await fetch(`http://127.0.0.1:${testPort}/pair`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: pairing.code, deviceName: 'Pairing test phone' }) });
  const paired = await response.json();
  assert.equal(response.ok, true);
  assert.equal(paired.ok, true);
  const poll = await fetch(`${paired.baseUrl}/paired/poll?token=${encodeURIComponent(paired.token)}`);
  const pollResult = await poll.json();
  assert.equal(poll.ok, true);
  assert.equal(pollResult.paired ?? true, true);
  const capture = await window.webContents.executeJavaScript('window.taxLedger.startPhoneCapture()');
  assert.equal(capture.paired, true);
  const upload = await fetch(`${paired.baseUrl}/paired/upload?token=${encodeURIComponent(paired.token)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageData: 'data:image/jpeg;base64,SGVsbG8=' }) });
  const uploadResult = await upload.json();
  assert.equal(upload.ok, true);
  assert.equal(uploadResult.ok, true);
  await window.webContents.executeJavaScript('window.taxLedger.unpairPhone()');
  console.log(JSON.stringify({ oneTimeCode: true, rememberedToken: true, pairedCapture: true, photoUpload: true }));
  window.destroy();
  app.quit();
}

app.whenReady().then(main).catch((error) => { console.error(error); app.exit(1); });

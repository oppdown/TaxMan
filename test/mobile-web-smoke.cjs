'use strict';

const assert = require('node:assert/strict');
const { app, BrowserWindow } = require('electron');
const path = require('node:path');

function wait(ms = 80) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function main() {
  const window = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
  await window.loadFile(path.join(__dirname, '..', 'mobile-dist', 'index.html'));
  const result = await window.webContents.executeJavaScript(`(async () => {
    const wait = () => new Promise((resolve) => setTimeout(resolve, 60));
    const set = (id, value) => { const element = document.getElementById(id); element.value = value; element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true })); };
    const companionSurface = Boolean(document.querySelector('.companion-page'));
    document.querySelector('[data-action="pair-computer"]')?.click(); await wait();
    const pairingForm = Boolean(document.getElementById('pair-computer-form'));
    const qrScanButton = Boolean(document.querySelector('[data-action="scan-pairing-qr"]'));
    const qrDecoderLoaded = typeof window.jsQR === 'function';
    document.querySelector('[data-action="cancel-companion-pairing"]')?.click(); await wait();
    document.getElementById('quick-add').click(); await wait();
    const mobileControls = { companionSurface, pairingForm, qrScanButton, qrDecoderLoaded, form: Boolean(document.getElementById('transaction-form')), directCameraButton: Boolean(document.querySelector('[data-action="take-receipt-photo"]')), cameraInput: document.getElementById('receipt-photo')?.accept === 'image/*' };
    document.querySelector('[data-action="calculate-business-use"]')?.click(); await wait();
    mobileControls.workUseCalculator = document.getElementById('work-use-percent')?.textContent.includes('33.33%');
    document.getElementById('work-use-form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await wait();
    set('transaction-company', 'company-hart-emc'); set('transaction-category', 'expense-utilities'); set('transaction-date', '090826'); set('transaction-description', 'Mobile smoke bill'); set('transaction-amount', '18.25');
    document.getElementById('transaction-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await wait();
    return { ...mobileControls, saved: document.body.textContent.includes('Mobile smoke bill'), localStore: Boolean(localStorage.getItem('taxman.local-store.v1')) };
  })()`);
  assert.equal(result.form, true);
  assert.equal(result.companionSurface, true);
  assert.equal(result.pairingForm, true);
  assert.equal(result.qrScanButton, true);
  assert.equal(result.qrDecoderLoaded, true);
  assert.equal(result.directCameraButton, true);
  assert.equal(result.cameraInput, true);
  assert.equal(result.workUseCalculator, true);
  assert.equal(result.saved, true);
  assert.equal(result.localStore, true);
  console.log(JSON.stringify(result));
  window.destroy();
  app.quit();
}

app.whenReady().then(main).catch((error) => { console.error(error); app.exit(1); });

'use strict';

const test = require('node:assert/strict');
const { app, BrowserWindow } = require('electron');
const { URL } = require('node:url');
require('../src/main.cjs');

function wait(ms = 100) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function main() {
  await wait(250);
  const window = BrowserWindow.getAllWindows()[0];
  if (!window) throw new Error('TaxMan window did not start');
  await window.webContents.executeJavaScript(`document.getElementById('quick-add').click()`);
  await wait();
  const captureState = await window.webContents.executeJavaScript(`(async () => { document.querySelector('[data-action="start-phone-capture"]').click(); await new Promise((resolve) => setTimeout(resolve, 100)); return { url: document.getElementById('phone-capture-url').value, qr: document.querySelector('.phone-qr img')?.src || '' }; })()`);
  const captureUrl = captureState.url;
  test.match(captureState.qr, /^data:image\/png;base64,/);
  const page = await fetch(captureUrl);
  test.equal(page.status, 200);
  const pageHtml = await page.text();
  test.match(pageHtml, /Take bill photo/);
  test.match(pageHtml, /Send Another Photo/);
  const token = new URL(captureUrl).searchParams.get('token');
  const imageData = `data:image/jpeg;base64,${Buffer.from('integration-photo').toString('base64')}`;
  const upload = await fetch(new URL(`/upload?token=${token}`, captureUrl), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageData }) });
  test.equal(upload.status, 200);
  await wait(180);
  const result = await window.webContents.executeJavaScript(`({ hasPreview: Boolean(document.querySelector('.receipt-preview img')), modalClosed: !document.getElementById('phone-capture-url'), imageData: document.querySelector('.receipt-preview img')?.src || '' })`);
  test.equal(result.hasPreview, true);
  test.equal(result.modalClosed, true);
  test.equal(result.imageData, imageData);
  console.log(JSON.stringify({ phoneCapturePage: true, uploadRoute: true, receiptPreview: true, qrCode: true }));
  window.destroy();
  app.quit();
}

app.whenReady().then(main).catch((error) => { console.error(error); app.exit(1); });

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('taxLedger', {
  supportsPhoneCapture: true,
  loadStore: () => ipcRenderer.invoke('store:load'),
  saveStore: (store) => ipcRenderer.invoke('store:save', store),
  importJson: () => ipcRenderer.invoke('store:import'),
  exportJson: (store) => ipcRenderer.invoke('store:export-json', store),
  exportCsv: (store, year) => ipcRenderer.invoke('store:export-csv', store, year),
  exportPdf: (store, year) => ipcRenderer.invoke('report:export-pdf', store, year),
  openFolder: (filePath) => ipcRenderer.invoke('app:open-folder', filePath),
  checkForUpdates: () => ipcRenderer.invoke('app:check-for-updates'),
  onUpdateStatus: (callback) => ipcRenderer.on('app:update-status', (_event, status) => callback(status)),
  getVersion: () => ipcRenderer.invoke('app:version'),
  startPhoneCapture: () => ipcRenderer.invoke('phone-capture:start'),
  stopPhoneCapture: () => ipcRenderer.invoke('phone-capture:stop'),
  supportsPairing: true,
  startPhonePairing: () => ipcRenderer.invoke('phone-pairing:start'),
  getPairedPhone: () => ipcRenderer.invoke('phone-pairing:get'),
  unpairPhone: () => ipcRenderer.invoke('phone-pairing:remove'),
  supportsOcr: true,
  readBillPhoto: (imageData, store) => ipcRenderer.invoke('ocr:bill', imageData, store),
  onPhoneCaptureUploaded: (callback) => ipcRenderer.on('phone-capture:uploaded', (_event, payload) => callback(payload)),
  onMenuAction: (callback) => ipcRenderer.on('menu:action', (_event, action) => callback(action))
});

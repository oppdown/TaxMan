'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('taxLedger', {
  loadStore: () => ipcRenderer.invoke('store:load'),
  saveStore: (store) => ipcRenderer.invoke('store:save', store),
  importJson: () => ipcRenderer.invoke('store:import'),
  exportJson: (store) => ipcRenderer.invoke('store:export-json', store),
  exportCsv: (store, year) => ipcRenderer.invoke('store:export-csv', store, year),
  exportPdf: (store, year) => ipcRenderer.invoke('report:export-pdf', store, year),
  openFolder: (filePath) => ipcRenderer.invoke('app:open-folder', filePath),
  getVersion: () => ipcRenderer.invoke('app:version')
});

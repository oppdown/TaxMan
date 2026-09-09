'use strict';

const { app, BrowserWindow } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createEmptyStore, buildReportHtml } = require('../src/core.cjs');

async function main() {
  const store = createEmptyStore();
  store.companies = [
    { id: 'client', name: 'Example Client', classification: 'Income source', phone: '', email: '', website: '', notes: '' },
    { id: 'utility', name: 'Georgia Power', classification: 'Utility', phone: '', email: '', website: '', notes: '' },
    { id: 'software', name: 'Example Software', classification: 'Vendor', phone: '', email: '', website: '', notes: '' }
  ];
  store.transactions = [
    { id: 'income', taxYear: 2025, date: '2025-02-14', type: 'income', companyId: 'client', categoryId: 'income-freelance', description: 'Website project', amountCents: 325000, businessUsePercent: null, homeOfficeRelated: false, notes: 'Sample data', createdAt: '', updatedAt: '' },
    { id: 'utility', taxYear: 2025, date: '2025-03-02', type: 'expense', companyId: 'utility', categoryId: 'expense-home-office', description: 'Electricity', amountCents: 14600, businessUsePercent: 25, homeOfficeRelated: true, notes: 'Sample data', createdAt: '', updatedAt: '' },
    { id: 'software', taxYear: 2025, date: '2025-04-05', type: 'expense', companyId: 'software', categoryId: 'expense-software', description: 'Annual software subscription', amountCents: 7999, businessUsePercent: 100, homeOfficeRelated: false, notes: 'Sample data', createdAt: '', updatedAt: '' }
  ];
  for (let index = 0; index < 38; index += 1) {
    store.transactions.push({ id: `extra-${index}`, taxYear: 2025, date: `2025-${String((index % 9) + 1).padStart(2, '0')}-${String((index % 27) + 1).padStart(2, '0')}`, type: 'expense', companyId: index % 2 ? 'utility' : 'software', categoryId: index % 2 ? 'expense-utilities' : 'expense-office-supplies', description: `Sample ledger line ${index + 1}`, amountCents: 1250 + index * 17, businessUsePercent: index % 2 ? 50 : 100, homeOfficeRelated: index % 2 === 1, notes: '' , createdAt: '', updatedAt: '' });
  }
  const output = path.join(__dirname, '..', 'tmp', 'pdfs', 'tax-ledger-2025-sample.pdf');
  await fs.mkdir(path.dirname(output), { recursive: true });
  const reportWindow = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  try {
    await reportWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buildReportHtml(store))}`);
    const pdf = await reportWindow.webContents.printToPDF({ landscape: true, pageSize: 'Letter', printBackground: true, margins: { marginType: 'default' } });
    await fs.writeFile(output, pdf);
  } finally { reportWindow.destroy(); }
  console.log(output);
  app.quit();
}

app.whenReady().then(main).catch((error) => { console.error(error); app.exit(1); });

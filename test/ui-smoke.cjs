'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('node:path');

function waitForRender() { return new Promise((resolve) => setTimeout(resolve, 30)); }

async function main() {
  const window = new BrowserWindow({ show: false, webPreferences: { preload: path.join(__dirname, 'ui-smoke-preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: false } });
  await window.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  const execution = window.webContents.executeJavaScript(`(async () => {
    const wait = () => new Promise((resolve) => setTimeout(resolve, 35));
    const set = (id, value) => { const element = document.getElementById(id); element.value = value; element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true })); };
    const submit = async (id) => { document.getElementById(id).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await wait(); };
    const checks = {};

    document.getElementById('quick-add').click(); await wait();
    checks.quickAddOpensForm = Boolean(document.getElementById('transaction-form'));
    checks.newTransactionDateStartsBlank = document.getElementById('transaction-date')?.value === '';

    set('transaction-company', '__create__'); await wait();
    checks.createNewFromDropdown = document.getElementById('modal-title')?.textContent.includes('Create new');
    set('company-name', 'Smoke Company');
    await submit('company-form');
    checks.createNewReturnsToForm = document.getElementById('transaction-company')?.value !== '' && !document.getElementById('modal-title');

    const category = document.getElementById('transaction-category');
    category.value = '';
    category.dispatchEvent(new KeyboardEvent('keydown', { key: 'u', bubbles: true }));
    checks.categoryHotkeySelectsUtilities = category.value === 'expense-utilities';
    set('transaction-category', 'expense-office-supplies');
    set('transaction-date', '090826');
    set('transaction-description', 'Smoke test expense');
    set('transaction-amount', '12.50');
    document.getElementById('home-office-related').click();
    checks.homeOfficeDefaultsTo33 = document.getElementById('business-use')?.value === '33';
    document.getElementById('transaction-amount').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await wait();
    checks.transactionSaves = document.querySelector('.data-table')?.textContent.includes('Smoke test expense');
    checks.compactDateSelectsYear = document.getElementById('year-select')?.value === '2026' && document.body.textContent.includes('09/08/2026');

    document.querySelector('[data-view="companies"]').click(); await wait();
    const companyRow = [...document.querySelectorAll('tbody tr')].find((row) => row.textContent.includes('Smoke Company'));
    if (!companyRow) throw new Error('Smoke Company was not present in the Companies & Sources directory');
    companyRow.querySelector('[data-action="edit-company"]').click(); await wait();
    set('company-name', 'Smoke Company Updated');
    await submit('company-form');
    checks.companyEditStaysInDirectory = document.getElementById('page-title').textContent === 'Companies & Sources' && document.body.textContent.includes('Smoke Company Updated');

    document.querySelector('[data-menu="help"]').click(); await wait();
    checks.helpMenuOpens = !document.querySelector('[data-menu-popup="help"]').hidden;
    document.querySelector('[data-action="show-about"]').click(); await wait();
    checks.aboutShowsVersion = document.body.textContent.includes('Version 0.2.1');
    document.querySelector('[data-action="close-modal"]').click(); await wait();

    document.querySelector('[data-view="reports"]').click(); await wait();
    checks.reportActionsPresent = ['export-pdf', 'export-csv', 'backup-json', 'restore-json'].every((action) => Boolean(document.querySelector('[data-action="' + action + '"]')));
    document.querySelector('[data-action="export-pdf"]').click(); await wait();
    checks.pdfNoticeStaysWithReport = document.body.textContent.includes('PDF saved to test-report.pdf') && !document.querySelector('[data-action="backup-json"]').closest('.panel').textContent.includes('test-report.pdf');
    document.querySelector('[data-action="backup-json"]').click(); await wait();
    checks.backupNoticeStaysWithBackup = document.body.textContent.includes('Backup saved to test-backup.json') && !document.querySelector('[data-action="export-pdf"]').closest('.panel').textContent.includes('test-backup.json');
    document.querySelector('[data-view="companies"]').click(); await wait();
    checks.clearCompanyButtonPresent = Boolean(document.querySelector('[data-action="clear-companies"]'));
    return checks;
  })()`);
  const result = await Promise.race([execution, new Promise((_, reject) => setTimeout(() => reject(new Error('UI smoke timed out after 10 seconds')), 10000))]);
  window.destroy();
  app.quit();
  const failures = Object.entries(result).filter(([, passed]) => !passed);
  if (failures.length) throw new Error(`UI smoke failures: ${failures.map(([name]) => name).join(', ')}`);
  console.log(JSON.stringify(result));
}

app.whenReady().then(main).catch((error) => { console.error(error); app.exit(1); });

'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('node:path');

function waitForRender() { return new Promise((resolve) => setTimeout(resolve, 30)); }

async function main() {
  const window = new BrowserWindow({ show: false, webPreferences: { preload: path.join(__dirname, 'ui-smoke-preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: false } });
  await window.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  const execution = window.webContents.executeJavaScript(`(async () => {
    const wait = () => new Promise((resolve) => setTimeout(resolve, 35));
    const set = (id, value) => { const element = document.getElementById(id); if (!element) throw new Error('Missing field ' + id + '; title=' + document.getElementById('page-title')?.textContent + '; body=' + document.body.textContent.slice(0, 500)); element.value = value; element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true })); };
    const submit = async (id) => { document.getElementById(id).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await wait(); };
    const checks = {};
    checks.singleFevMenu = document.querySelectorAll('.menu-bar').length === 0;

    document.getElementById('quick-add').click(); await wait();
    checks.quickAddOpensForm = Boolean(document.getElementById('transaction-form'));
    checks.newTransactionDateStartsBlank = document.getElementById('transaction-date')?.value === '';
    checks.phonePhotoCapturePresent = Boolean(document.querySelector('[data-action="start-phone-capture"]')) && document.getElementById('receipt-photo')?.accept === 'image/*';
    checks.readBillSupportEnabled = window.taxLedger.supportsOcr === true;

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
    checks.homeOfficeDefaultsTo33 = document.getElementById('business-use')?.value === '33.33';
    document.getElementById('transaction-amount').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await wait();
    checks.transactionSaves = document.querySelector('.data-table')?.textContent.includes('Smoke test expense');
    document.querySelector('[data-action="mark-paid"]')?.click(); await wait();
    checks.paymentModalShowsDetails = document.getElementById('payment-form')?.textContent.includes('Date paid') && document.body.textContent.includes('Smoke test expense');
    set('paid-date', '091026');
    document.getElementById('payment-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await wait();
    checks.paymentStatusPersists = document.querySelector('.data-table')?.textContent.includes('Paid') && document.querySelector('.data-table')?.textContent.includes('09/10/2026');
    checks.compactDateSelectsYear = document.getElementById('year-select')?.value === '2026' && document.body.textContent.includes('09/08/2026');
    document.querySelector('[data-action="edit-transaction"]')?.click(); await wait();
    document.querySelector('[data-action="calculate-business-use"]')?.click(); await wait();
    checks.workUseCalculatorOpens = document.getElementById('work-use-form')?.textContent.includes('Calculated business use');
    checks.workUseCalculatorShows33 = document.getElementById('work-use-percent')?.textContent.includes('33.33%');
    document.getElementById('work-use-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await wait();
    checks.workUseApplied = document.getElementById('business-use')?.value === '33.33';
    document.querySelector('[data-action="cancel-form"]')?.click(); await wait();

    document.querySelector('[data-view="companies"]').click(); await wait();
    const companyRow = [...document.querySelectorAll('tbody tr')].find((row) => row.textContent.includes('Smoke Company'));
    if (!companyRow) throw new Error('Smoke Company was not present in the Companies & Sources directory');
    companyRow.querySelector('[data-action="edit-company"]').click(); await wait();
    checks.companyHomeOfficePreferencePresent = Boolean(document.getElementById('company-always-home-office'));
    set('company-name', 'Smoke Company Updated');
    document.getElementById('company-always-home-office').click();
    await submit('company-form');
    checks.companyEditStaysInDirectory = document.getElementById('page-title').textContent === 'Companies & Sources' && document.body.textContent.includes('Smoke Company Updated');
    document.querySelector('[data-view="transactions"]').click(); await wait();
    document.querySelector('[data-action="show-add"]').click(); await wait();
    const smokeCompanyOption = [...document.querySelectorAll('#transaction-company option')].find((option) => option.textContent.includes('Smoke Company Updated'));
    document.getElementById('transaction-company').value = smokeCompanyOption.value;
    document.getElementById('transaction-company').dispatchEvent(new Event('change', { bubbles: true })); await wait();
    checks.companyHomeOfficeDefaultsNewExpense = document.getElementById('home-office-related')?.checked === true && document.getElementById('business-use')?.value === '33.33';
    document.querySelector('[data-action="cancel-form"]').click(); await wait();

    await window.taxLedger.testEmitMenuAction('show-about'); await wait();
    checks.helpMenuOpens = Boolean(document.querySelector('[aria-labelledby="about-title"]'));
    checks.aboutShowsVersion = document.body.textContent.includes('Version 0.4.6');
    document.querySelector('[data-action="close-modal"]').click(); await wait();
    await window.taxLedger.testEmitMenuAction('check-for-updates'); await wait();
    checks.checkForUpdatesAction = document.body.textContent.includes('Automatic updates are available in the installed Windows version of TaxMan.');
    await window.taxLedger.testEmitMenuAction('view-reports'); await wait();
    checks.nativeViewActionWorks = document.getElementById('page-title').textContent === 'Reports & Backup';

    checks.reportActionsPresent = ['export-pdf', 'export-csv', 'backup-json', 'restore-json'].every((action) => Boolean(document.querySelector('[data-action="' + action + '"]')));
    document.querySelector('[data-action="export-pdf"]').click(); await wait();
    checks.pdfNoticeStaysWithReport = document.body.textContent.includes('PDF saved to test-report.pdf') && !document.querySelector('[data-action="backup-json"]').closest('.panel').textContent.includes('test-report.pdf');
    document.querySelector('[data-action="backup-json"]').click(); await wait();
    checks.backupNoticeStaysWithBackup = document.body.textContent.includes('Backup saved to test-backup.json') && !document.querySelector('[data-action="export-pdf"]').closest('.panel').textContent.includes('test-backup.json');
    window.confirm = () => true;
    document.querySelector('[data-action="restore-json"]').click(); await wait();
    document.querySelector('[data-view="transactions"]').click(); await wait();
    checks.restorePopulatesLedger = document.body.textContent.includes('Restored income') && document.body.textContent.includes('$321.00') && document.getElementById('year-select')?.value === '2026';
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

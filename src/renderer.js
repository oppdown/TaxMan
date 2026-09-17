'use strict';

const TAX_YEAR = 2025;
const NEW_COMPANY = '__create__';
const state = { store: null, view: 'dashboard', selectedYear: 2025, transactionDraft: null, phoneCapture: null, phonePairing: null, companionPairing: false, companionPairingData: null, qrScanner: false, qrScannerMessage: '', companionComputer: null, companionRequest: null, companionLastSent: false, companionAppendNext: false, pendingPhonePhoto: null, paymentModal: null, workUseModal: false, aboutOpen: false, shortcutsOpen: false, openMenu: null, ocr: null, appVersion: '0.4.8', search: '', typeFilter: 'all', categoryFilter: 'all', lastPdfPath: '', lastCsvPath: '', lastBackupPath: '' };
let companionPollTimer;
let pairingPollTimer;
let qrScannerStream;
let qrScannerFrame;

document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  if (window.taxLedger.onMenuAction) window.taxLedger.onMenuAction((action) => handleAction(action));
  if (window.taxLedger.onPhoneCaptureUploaded) window.taxLedger.onPhoneCaptureUploaded((imageData) => handlePhoneCaptureUploaded(imageData));
  if (window.taxLedger.onUpdateStatus) window.taxLedger.onUpdateStatus((status) => handleUpdateStatus(status));
  try { state.store = await window.taxLedger.loadStore(); state.selectedYear = bestYearForStore(state.store, state.store.taxYear || 2025); state.appVersion = await window.taxLedger.getVersion(); if (window.taxLedger.isMobileCompanion) { state.companionComputer = await window.taxLedger.getPairedComputer(); startCompanionPolling(); } render(); }
  catch (error) { renderFatal(error); }
});

function bindEvents() {
  document.addEventListener('click', async (event) => {
    const nav = event.target.closest('[data-view]');
    if (nav) { navigateTo(nav.dataset.view); return; }
    const action = event.target.closest('[data-action]');
    if (!action) return;
    await handleAction(action.dataset.action, action);
  });
  document.addEventListener('submit', async (event) => {
    const formId = event.target?.getAttribute?.('id');
    if (formId === 'transaction-form') { event.preventDefault(); await saveTransaction(new FormData(event.target)); }
    if (formId === 'company-form') { event.preventDefault(); await saveCompany(new FormData(event.target)); }
    if (formId === 'category-form') { event.preventDefault(); await saveCategory(new FormData(event.target)); }
    if (formId === 'pair-computer-form') { event.preventDefault(); await pairComputer(new FormData(event.target)); }
    if (formId === 'payment-form') { event.preventDefault(); await savePayment(new FormData(event.target)); }
    if (formId === 'work-use-form') { event.preventDefault(); await applyWorkUse(new FormData(event.target)); }
  });
  document.addEventListener('change', (event) => {
    if (event.target.id === 'year-select') { state.selectedYear = event.target.value === 'all' ? 'all' : Number(event.target.value); render(); }
    if (event.target.id === 'transaction-type') {
      state.transactionDraft.type = event.target.value;
      state.transactionDraft.categoryId = '';
      render();
    }
    if (event.target.id === 'transaction-company' && event.target.value === NEW_COMPANY) {
      state.companyModal = { editId: null, returnToTransaction: true };
      render();
    }
    if (event.target.id === 'transaction-company' && event.target.value !== NEW_COMPANY) {
      const company = findCompany(event.target.value);
      if (company?.alwaysHomeOfficeRelated && state.transactionDraft?.type === 'expense') {
        state.transactionDraft.homeOfficeRelated = true;
        state.transactionDraft.businessUsePercent = calculateTimeBusinessUsePercent(state.store.workTime);
        render();
      }
    }
    if (event.target.id === 'existing-company') {
      state.companyModal.selectedExistingId = event.target.value || '';
      render();
    }
    if (event.target.id === 'home-office-related' && event.target.checked) {
      const businessUse = document.getElementById('business-use');
      if (businessUse) businessUse.value = String(calculateTimeBusinessUsePercent(state.store.workTime));
    }
    if (event.target.id === 'receipt-photo' && event.target.files?.[0]) handleReceiptFile(event.target.files[0]);
    if (event.target.id === 'companion-photo' && event.target.files?.[0]) handleCompanionPhoto(event.target.files[0]);
    if (event.target.id === 'companion-append-page') state.companionAppendNext = event.target.checked;
  });
  document.addEventListener('input', (event) => {
    if (event.target.id === 'transaction-search') { state.search = event.target.value; render(); focusInput('transaction-search', state.search); }
    if (event.target.id === 'type-filter') { state.typeFilter = event.target.value; render(); }
    if (event.target.id === 'category-filter') { state.categoryFilter = event.target.value; render(); }
    if (event.target.id === 'work-hours-per-day' || event.target.id === 'work-days-per-week') updateWorkUsePreview();
  });
  document.addEventListener('keydown', (event) => {
    if (event.target.id === 'transaction-category' && /^[a-z]$/i.test(event.key)) {
      const categorySelect = event.target;
      const match = [...categorySelect.options].find((option) => option.textContent.trim().toLowerCase().startsWith(event.key.toLowerCase()) && option.value);
      if (match) { event.preventDefault(); categorySelect.value = match.value; }
    }
    if (event.key === 'Enter' && state.transactionDraft && event.target.closest('#transaction-form') && event.target.tagName !== 'TEXTAREA') {
      event.preventDefault(); document.getElementById('transaction-form')?.requestSubmit(); return;
    }
    if (event.ctrlKey && event.key.toLowerCase() === 'n') { event.preventDefault(); openTransaction('expense'); }
    else if (event.ctrlKey && event.key.toLowerCase() === 's' && state.transactionDraft) { event.preventDefault(); document.getElementById('transaction-form')?.requestSubmit(); }
    else if (event.ctrlKey && /^[1-4]$/.test(event.key)) { event.preventDefault(); state.view = ['dashboard', 'transactions', 'companies', 'reports'][Number(event.key) - 1]; state.transactionDraft = null; render(); }
    else if (event.key === 'Escape') { if (state.qrScanner || state.paymentModal || state.workUseModal || state.companyModal || state.phoneCapture || state.phonePairing || state.companionPairing || state.aboutOpen || state.shortcutsOpen) { if (state.qrScanner) stopQrScanner(); if (state.phoneCapture) window.taxLedger.stopPhoneCapture(); state.companyModal = null; state.phoneCapture = null; state.phonePairing = null; state.companionPairing = false; state.companionPairingData = null; state.qrScanner = false; state.paymentModal = null; state.workUseModal = false; state.aboutOpen = false; state.shortcutsOpen = false; render(); } else if (state.transactionDraft) { state.transactionDraft = null; render(); } else if (state.openMenu) { state.openMenu = null; render(); } }
  });
}

async function handleAction(action, element) {
  if (action?.startsWith('view-')) { navigateTo(action.slice('view-'.length)); return; }
  if (action === 'show-add') openTransaction('expense');
  if (action === 'show-add-income') openTransaction('income');
  if (action === 'cancel-form') { state.transactionDraft = null; render(); }
  if (action === 'edit-transaction') openTransaction('', element.dataset.id);
  if (action === 'delete-transaction') await deleteTransaction(element.dataset.id);
  if (action === 'mark-paid') { state.paymentModal = { id: element.dataset.id }; render(); }
  if (action === 'close-payment-modal') { state.paymentModal = null; render(); }
  if (action === 'unmark-paid') await unmarkPaid();
  if (action === 'calculate-business-use') { state.workUseModal = true; render(); }
  if (action === 'close-work-use-modal') { state.workUseModal = false; render(); }
  if (action === 'add-company') { state.companyModal = { editId: null, returnToTransaction: false }; render(); }
  if (action === 'edit-company') { state.companyModal = { editId: element.dataset.id, returnToTransaction: false }; render(); }
  if (action === 'close-modal') { if (state.qrScanner) stopQrScanner(); if (state.phoneCapture) await window.taxLedger.stopPhoneCapture(); state.companyModal = null; state.phoneCapture = null; state.phonePairing = null; state.companionPairing = false; state.companionPairingData = null; state.qrScanner = false; state.paymentModal = null; state.workUseModal = false; state.aboutOpen = false; state.shortcutsOpen = false; render(); }
  if (action === 'start-phone-capture') await beginPhoneCapture();
  if (action === 'pair-phone') await beginPhonePairing();
  if (action === 'unpair-phone') { await window.taxLedger.unpairPhone(); state.phoneCapture = null; toast('Phone pairing removed.'); render(); }
  if (action === 'pair-computer') { state.companionPairing = true; state.companionPairingData = null; render(); }
  if (action === 'scan-pairing-qr') await openPairingQrScanner();
  if (action === 'close-qr-scanner') { stopQrScanner(); state.qrScanner = false; render(); }
  if (action === 'cancel-companion-pairing') { stopQrScanner(); state.qrScanner = false; state.companionPairing = false; state.companionPairingData = null; render(); }
  if (action === 'unpair-computer') { await window.taxLedger.unpairComputer(); state.companionComputer = null; state.companionRequest = null; toast('PC pairing removed.'); render(); }
  if (action === 'companion-take-photo') document.getElementById('companion-photo')?.click();
  if (action === 'companion-send-another') await requestAnotherCompanionPhoto();
  if (action === 'use-pending-photo-current') usePendingPhonePhoto('current');
  if (action === 'use-pending-photo-new') usePendingPhonePhoto('new');
  if (action === 'discard-pending-photo') { state.pendingPhonePhoto = null; toast('The extra bill photo was discarded.'); render(); }
  if (action === 'read-bill-photo') await readBillPhoto();
  if (action === 'take-receipt-photo') document.getElementById('receipt-photo')?.click();
  if (action === 'cancel-phone-capture') { await window.taxLedger.stopPhoneCapture(); state.phoneCapture = null; render(); }
  if (action === 'copy-phone-url') await copyPhoneUrl();
  if (action === 'copy-pairing-url') await copyText(state.phonePairing?.url, 'Pairing address copied.');
  if (action === 'remove-receipt-photo') { removeReceiptImage(Number(element.dataset.index)); }
  if (action === 'show-about') { state.openMenu = null; state.aboutOpen = true; render(); }
  if (action === 'show-shortcuts') { state.openMenu = null; state.shortcutsOpen = true; render(); }
  if (action === 'check-for-updates') { state.openMenu = null; const result = await window.taxLedger.checkForUpdates(); if (result?.status === 'unavailable' || result?.status === 'error') toast(result.message || 'TaxMan could not check for updates.', true); else if (result?.status === 'checking') toast(result.message || 'Checking for a TaxMan update…'); }
  if (action === 'file-save') await saveLedger();
  if (action === 'file-save-as') await exportFile('json');
  if (action === 'use-today') { const input = document.getElementById('transaction-date'); if (input) { input.value = formatDateInput(todayIso()); input.focus(); } }
  if (action === 'use-paid-today') { const input = document.getElementById('paid-date'); if (input) { input.value = formatDateInput(todayIso()); input.focus(); } }
  if (action === 'delete-company') await deleteCompany(element.dataset.id);
  if (action === 'clear-companies') await clearCompanyData();
  if (action === 'toggle-category') await toggleCategory(element.dataset.id);
  if (action === 'export-pdf') await exportFile('pdf');
  if (action === 'export-csv') await exportFile('csv');
  if (action === 'backup-json') await exportFile('json');
  if (action === 'restore-json') await restoreJson();
  if (action === 'open-folder') await window.taxLedger.openFolder(element.dataset.path);
}

function render() {
  if (!state.store) return;
  const titles = { dashboard: 'Dashboard', transactions: 'Transactions', companies: 'Companies & Sources', reports: 'Reports & Backup' };
  document.body.classList.toggle('companion-mobile', Boolean(window.taxLedger.isMobileCompanion));
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === state.view));
  document.getElementById('page-title').textContent = titles[state.view];
  document.getElementById('year-eyebrow').textContent = state.selectedYear === 'all' ? 'All years' : `${state.selectedYear} tax preparation`;
  populateYearSelector();
  document.getElementById('view-root').innerHTML = window.taxLedger.isMobileCompanion && state.view === 'dashboard' ? renderCompanionDashboard() : state.view === 'dashboard' ? renderDashboard() : state.view === 'transactions' ? renderTransactions() : state.view === 'companies' ? renderCompanies() : renderReports();
  document.getElementById('modal-root').innerHTML = state.pendingPhonePhoto ? renderPendingPhonePhotoModal() : state.companyModal ? renderCompanyModal() : state.phonePairing ? renderPhonePairingModal() : state.qrScanner ? renderQrScannerModal() : state.paymentModal ? renderPaymentModal() : state.workUseModal ? renderWorkUseModal() : state.companionPairing ? renderCompanionPairingModal() : state.phoneCapture ? renderPhoneCaptureModal() : state.aboutOpen ? renderAboutModal() : state.shortcutsOpen ? renderShortcutsModal() : '';
}

function navigateTo(view) {
  state.view = view;
  state.openMenu = null;
  if (state.view !== 'transactions') state.transactionDraft = null;
  render();
}

function populateYearSelector() {
  const select = document.getElementById('year-select');
  if (!select) return;
  const years = new Set([2024, 2025, 2026, 2027, new Date().getFullYear(), ...state.store.transactions.map((transaction) => transaction.taxYear)]);
  select.innerHTML = `<option value="all" ${state.selectedYear === 'all' ? 'selected' : ''}>All years</option>${[...years].filter((year) => Number.isInteger(year)).sort((a, b) => a - b).map((year) => `<option value="${year}" ${Number(year) === Number(state.selectedYear) ? 'selected' : ''}>${year}</option>`).join('')}`;
}

function bestYearForStore(store, preferredYear) {
  const preferred = Number(preferredYear);
  const years = [...new Set((store.transactions || []).map((transaction) => Number(transaction.taxYear)).filter((year) => Number.isInteger(year)))];
  return years.includes(preferred) || !years.length ? (Number.isInteger(preferred) ? preferred : TAX_YEAR) : Math.max(...years);
}

function renderFatal(error) {
  document.getElementById('view-root').innerHTML = `<section class="panel"><div class="panel-body"><h2>TaxMan could not load</h2><p>${escapeHtml(error.message || error)}</p><p class="muted">Your records were not changed. Close and reopen the app, then try again.</p></div></section>`;
}

function renderDashboard() {
  const summary = calculateSummary(state.store, state.selectedYear);
  const recent = transactionsForYear(state.store, state.selectedYear).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
  return `<div class="cards">
    ${metric('Gross income', money(summary.incomeCents), 'All recorded income', 'accent')}
    ${metric('Total expenses', money(summary.expenseCents), 'Recorded payments', 'orange')}
    ${metric('Allocated business expenses', money(summary.allocatedExpenseCents), 'Based on business-use %', 'green')}
    ${metric('Net before tax', money(summary.netBeforeTaxCents), 'Income minus all expenses', 'purple')}
  </div>
  <div class="grid-2">
    <section class="panel"><div class="panel-header"><div><h2>Home office snapshot</h2><p>Costs you marked as related to working from home.</p></div><button class="secondary-button" data-view="transactions">View entries</button></div><div class="panel-body"><div class="grid-3"><div><div class="metric-label">Recorded</div><div class="big-number">${money(summary.homeOfficeCents)}</div></div><div><div class="metric-label">Allocated</div><div class="big-number">${money(summary.homeOfficeAllocatedCents)}</div></div><div><div class="metric-label">Entries</div><div class="big-number">${summary.homeOfficeCount}</div></div></div><p class="notice" style="margin-top:20px">Allocation is a recordkeeping aid. Your preparer decides what is deductible and how it should be reported.</p></div></section>
    <section class="panel"><div class="panel-header"><div><h2>Get started</h2><p>Record the details while they are fresh.</p></div></div><div class="panel-body"><div class="report-actions"><button class="primary-button" data-action="show-add-income">＋ Add income</button><button class="secondary-button" data-action="show-add">＋ Add expense</button><button class="secondary-button" data-view="companies">Manage companies</button></div><p class="muted" style="margin-top:18px">Your ledger is saved locally on this computer. Use Reports &amp; Backup to create a copy for safekeeping.</p></div></section>
  </div>
  <section class="panel" style="margin-top:20px"><div class="panel-header"><div><h2>Recent transactions</h2><p>${state.store.transactions.length ? 'Your latest recorded activity.' : 'No entries yet.'}</p></div><button class="secondary-button" data-view="transactions">See all transactions</button></div>${recent.length ? transactionTable(recent, true) : emptyState('Start with your first entry', 'Use Add transaction to record income or an expense.')}</section>`;
}

function metric(label, value, note, tone) { return `<section class="panel metric-card ${tone}"><div class="metric-label">${label}</div><div class="metric-value">${value}</div><div class="metric-note">${note}</div></section>`; }

function renderTransactions() {
  if (state.transactionDraft) return renderTransactionForm();
  const filtered = filteredTransactions();
  const categories = [...state.store.categories].filter((category) => category.active).sort((a, b) => a.name.localeCompare(b.name));
  return `<section class="panel"><div class="panel-header"><div><h2>${selectedYearLabel()} transaction ledger</h2><p>One clear record for every income and business-related expense.</p></div><div class="report-actions"><button class="secondary-button" data-action="show-add-income">＋ Income</button><button class="primary-button" data-action="show-add">＋ Expense</button></div></div>
    <div class="panel-body"><div class="filters"><input id="transaction-search" type="search" placeholder="Search company, description, or notes" value="${escapeAttr(state.search)}"><select id="type-filter"><option value="all" ${state.typeFilter === 'all' ? 'selected' : ''}>All types</option><option value="income" ${state.typeFilter === 'income' ? 'selected' : ''}>Income</option><option value="expense" ${state.typeFilter === 'expense' ? 'selected' : ''}>Expense</option></select><select id="category-filter"><option value="all">All categories</option>${categories.map((category) => `<option value="${escapeAttr(category.id)}" ${state.categoryFilter === category.id ? 'selected' : ''}>${escapeHtml(category.name)}</option>`).join('')}</select><span class="muted">${filtered.length} of ${transactionsForYear(state.store, state.selectedYear).length} entries</span></div></div>${filtered.length ? transactionTable(filtered, true) : emptyState('No matching transactions', 'Try clearing a filter or add a new entry.')}</section>`;
}

function renderPaymentModal() {
  const transaction = state.store.transactions.find((item) => item.id === state.paymentModal?.id);
  if (!transaction) return '';
  const company = findCompany(transaction.companyId)?.name || 'Unknown company';
  const category = findCategory(transaction.categoryId)?.name || 'Unknown category';
  const paid = Boolean(transaction.paidDate);
  const paidDate = transaction.paidDate || todayIso();
  return `<div class="modal-backdrop"><section class="modal payment-modal" role="dialog" aria-modal="true" aria-labelledby="payment-title"><div class="modal-header"><div><span class="eyebrow">Payment status</span><h2 id="payment-title">${paid ? 'Update payment' : 'Mark transaction paid'}</h2></div><button class="close-button" data-action="close-payment-modal" aria-label="Close">×</button></div><div class="modal-body"><div class="payment-summary"><div><span>Company / source</span><strong>${escapeHtml(company)}</strong></div><div><span>Description</span><strong>${escapeHtml(transaction.description)}</strong></div><div><span>Amount</span><strong>${money(transaction.amountCents)}</strong></div><div><span>Bill date</span><strong>${escapeHtml(formatDateDisplay(transaction.date))}</strong></div>${transaction.type === 'expense' ? `<div><span>Category</span><strong>${escapeHtml(category)}</strong></div>` : ''}</div><form id="payment-form"><div class="field"><label class="required" for="paid-date">${paid ? 'Paid date' : 'Date paid'}</label><div class="inline-field"><input id="paid-date" name="paidDate" type="text" inputmode="numeric" autocomplete="off" placeholder="MMDDYY or MM/DD/YYYY" required value="${escapeAttr(formatDateInput(paidDate))}"><button type="button" class="secondary-button compact-button" data-action="use-paid-today">Today</button></div><small>Enter the date the payment actually cleared. The bill date stays unchanged.</small></div><div class="modal-actions"><button type="button" class="secondary-button" data-action="close-payment-modal">Cancel</button>${paid ? '<button type="button" class="danger-button" data-action="unmark-paid">Mark as unpaid</button>' : ''}<button type="submit" class="primary-button">${paid ? 'Save paid date' : 'Mark paid'}</button></div></form></div></section></div>`;
}

function renderWorkUseModal() {
  const workTime = state.store.workTime || { hoursPerDay: 8, daysPerWeek: 7 };
  const amountCents = Number(state.transactionDraft?.amountCents || 0);
  const percent = calculateTimeBusinessUsePercent(workTime);
  const allocated = Math.round(amountCents * percent / 100);
  return `<div class="modal-backdrop"><section class="modal work-use-modal" role="dialog" aria-modal="true" aria-labelledby="work-use-title"><div class="modal-header"><div><span class="eyebrow">Shared utility estimate</span><h2 id="work-use-title">Calculate business use</h2></div><button class="close-button" data-action="close-work-use-modal" aria-label="Close">×</button></div><div class="modal-body"><p class="work-use-intro">Enter the time you work in the home office. TaxMan compares it with the 168 hours in a full week and applies the result to this transaction.</p><form id="work-use-form"><div class="form-grid"><div class="field"><label class="required" for="work-hours-per-day">Work hours per day</label><input id="work-hours-per-day" name="hoursPerDay" type="number" min="0" max="24" step="0.25" value="${escapeAttr(workTime.hoursPerDay)}"><small>Use your typical average.</small></div><div class="field"><label class="required" for="work-days-per-week">Work days per week</label><input id="work-days-per-week" name="daysPerWeek" type="number" min="0" max="7" step="0.25" value="${escapeAttr(workTime.daysPerWeek)}"><small>Seven days × eight hours = 56 hours.</small></div></div><div class="work-use-result"><span>Calculated business use</span><strong id="work-use-percent">${formatPercent(percent)}</strong><p id="work-use-math">${workTime.hoursPerDay} × ${workTime.daysPerWeek} = ${Number(workTime.hoursPerDay * workTime.daysPerWeek).toFixed(2)} work hours ÷ 168 total hours</p>${amountCents ? `<p id="work-use-amount">This would allocate about <strong>${money(allocated)}</strong> of this ${money(amountCents)} transaction.</p>` : ''}</div><div class="notice">This is a reviewable recordkeeping estimate for shared costs such as utilities. It does not decide whether an expense is deductible; confirm the method with your tax preparer.</div><div class="modal-actions"><button type="button" class="secondary-button" data-action="close-work-use-modal">Cancel</button><button type="submit" class="primary-button">Use this percentage</button></div></form></div></section></div>`;
}

function renderTransactionForm() {
  const draft = state.transactionDraft;
  const isIncome = draft.type === 'income';
  const images = getReceiptImages(draft);
  const photoButton = window.taxLedger.supportsPhoneCapture ? `<button type="button" class="secondary-button" data-action="start-phone-capture">${images.length ? 'Send another photo' : 'Take with phone'}</button>` : '<button type="button" class="secondary-button" data-action="take-receipt-photo">Take photo</button>';
  const pagePreview = images.length ? `<div class="receipt-preview receipt-pages">${images.map((image, index) => `<figure class="receipt-page"><img src="${escapeAttr(image)}" alt="Bill photo page ${index + 1}"><figcaption>Page ${index + 1} <button type="button" class="icon-button danger-text" data-action="remove-receipt-photo" data-index="${index}">Remove</button></figcaption></figure>`).join('')}</div>` : '';
  return `<section class="panel form-panel"><div class="panel-body"><div class="form-title"><div><h2>${draft.id ? 'Edit transaction' : 'Add transaction'}</h2><p>Enter one income or expense item. Amounts are stored in U.S. dollars.</p></div><button class="icon-button" data-action="cancel-form" aria-label="Close form">✕</button></div><div class="entry-tip"><strong>Quick entry:</strong> Type dates as 090826. Ctrl+S saves, Esc cancels, and Ctrl+N starts a new expense.</div><form id="transaction-form"><div class="form-grid compact-form-grid">
    <div class="field date-field"><label class="required" for="transaction-date">Date</label><div class="inline-field"><input id="transaction-date" name="date" type="text" inputmode="numeric" autocomplete="off" placeholder="MMDDYY or MM/DD/YYYY" required value="${escapeAttr(formatDateInput(draft.date || ''))}"><button type="button" class="secondary-button compact-button" data-action="use-today">Today</button></div><small>Examples: 090826 or 09/08/2026. Any valid year is accepted.</small></div>
    <div class="field"><label class="required" for="transaction-type">Income or expense</label><select id="transaction-type" name="type"><option value="income" ${isIncome ? 'selected' : ''}>Income</option><option value="expense" ${!isIncome ? 'selected' : ''}>Expense</option></select></div>
    <div class="field"><label class="required" for="transaction-company">Company or source</label><select id="transaction-company" name="companyId" required>${companyOptions(draft.companyId)}</select><small>Choose “Create new…” to add a company without leaving this form.</small></div>
    <div class="field"><label class="required" for="transaction-category">${isIncome ? 'Income source' : 'Expense category'}</label><select id="transaction-category" name="categoryId" required>${categoryOptions(draft.type, draft.categoryId)}</select></div>
    <div class="field"><label class="required" for="transaction-description">Description</label><input id="transaction-description" name="description" required maxlength="160" placeholder="What was this for?" value="${escapeAttr(draft.description)}"></div>
    <div class="field"><label class="required" for="transaction-amount">Amount (USD)</label><input id="transaction-amount" name="amount" inputmode="decimal" required placeholder="0.00" value="${escapeAttr(draft.amountCents ? (draft.amountCents / 100).toFixed(2) : '')}"><small>Enter the full amount paid or received.</small></div>
    ${isIncome ? '' : `<div class="field"><label class="required" for="business-use">Business use</label><div class="inline-field"><input id="business-use" name="businessUsePercent" type="number" min="0" max="100" step="0.01" required value="${escapeAttr(draft.businessUsePercent ?? 100)}"><button type="button" class="secondary-button compact-button" data-action="calculate-business-use">Calculate from work time</button></div><small>Use the calculator for shared utilities or another reasonable time-based estimate.</small></div><div class="check-field"><input id="home-office-related" name="homeOfficeRelated" type="checkbox" ${draft.homeOfficeRelated ? 'checked' : ''}><label for="home-office-related">Mark as home-office-related</label></div>`}
    <div class="field wide"><label>Bill photo${images.length > 1 ? ` · ${images.length} pages` : ''}</label><div class="photo-actions">${photoButton}<label class="secondary-button file-button">Choose photo<input id="receipt-photo" type="file" accept="image/*" capture="environment"></label>${images.length && window.taxLedger.supportsOcr ? `<button type="button" class="secondary-button" data-action="read-bill-photo" ${state.ocr?.busy ? 'disabled' : ''}>${state.ocr?.busy ? 'Reading bill…' : 'Read bill details'}</button>` : ''}${images.length ? '<span class="photo-attached">Photo attached</span>' : '<span class="muted">Optional</span>'}</div>${pagePreview}${images.length ? `${state.ocr?.message ? `<div class="notice"><strong>${escapeHtml(state.ocr.message)}</strong> Verify every suggested field. OCR suggestions are never saved until you save this transaction.</div>` : ''}${state.ocr?.text ? `<details class="ocr-details"><summary>Show raw text read from bill</summary><pre>${escapeHtml(state.ocr.text)}</pre></details>` : ''}` : `<small>${window.taxLedger.supportsPhoneCapture ? 'Use the phone connection for a camera photo, or choose an image from this computer.' : 'Take a photo or choose an image. The bill stays on this device.'}</small>`}</div>
    ${draft.id ? `<div class="field wide"><label>Payment status</label><div class="payment-form-row"><span class="${draft.paidDate ? 'paid-pill' : 'unpaid-pill'}">${draft.paidDate ? `Paid ${escapeHtml(formatDateDisplay(draft.paidDate))}` : 'Not marked paid'}</span><button type="button" class="secondary-button" data-action="mark-paid" data-id="${escapeAttr(draft.id)}">${draft.paidDate ? 'Update payment' : 'Mark paid'}</button></div></div>` : ''}
    <div class="field wide"><label for="transaction-notes">Notes</label><textarea id="transaction-notes" name="notes" maxlength="500" placeholder="Optional receipt reference or context">${escapeHtml(draft.notes)}</textarea></div>
  </div><div class="form-actions"><button type="button" class="secondary-button" data-action="cancel-form">Cancel</button><button type="submit" class="primary-button">Save transaction</button></div></form></div></section>`;
}

function transactionTable(items, actions) {
  const rows = items.map((transaction) => {
    const company = findCompany(transaction.companyId)?.name || 'Unknown company';
    const category = findCategory(transaction.categoryId)?.name || 'Unknown category';
    const allocated = transaction.type === 'expense' ? businessAmount(transaction) : 0;
  const paymentStatus = transaction.paidDate ? `<span class="paid-pill">Paid</span><br><span class="muted">${escapeHtml(formatDateDisplay(transaction.paidDate))}</span>` : actions ? `<button class="secondary-button compact-button" data-action="mark-paid" data-id="${escapeAttr(transaction.id)}">Mark paid</button>` : '<span class="unpaid-pill">Unpaid</span>';
  return `<tr><td>${escapeHtml(formatDateDisplay(transaction.date))}</td><td><span class="type-pill ${transaction.type === 'income' ? 'type-income' : 'type-expense'}">${transaction.type === 'income' ? 'Income' : 'Expense'}</span></td><td><strong>${escapeHtml(company)}</strong><br><span class="muted">${escapeHtml(category)}</span></td><td>${escapeHtml(transaction.description)}${transaction.homeOfficeRelated ? '<br><span class="tag">Home office</span>' : ''}</td><td class="money">${money(transaction.amountCents)}</td><td class="money">${transaction.type === 'expense' ? `${formatPercent(transaction.businessUsePercent)}<br><span class="muted">${money(allocated)}</span>` : '—'}</td><td class="payment-status">${paymentStatus}</td>${actions ? `<td class="row-actions"><button class="icon-button" data-action="edit-transaction" data-id="${escapeAttr(transaction.id)}" title="Edit">Edit</button><button class="icon-button danger-text" data-action="delete-transaction" data-id="${escapeAttr(transaction.id)}" title="Delete">Delete</button></td>` : ''}</tr>`;
  }).join('');
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Type</th><th>Company/source &amp; category</th><th>Description</th><th>Amount</th><th>Business use<br>Allocated</th><th>Payment</th>${actions ? '<th>Actions</th>' : ''}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderCompanies() {
  const companies = [...state.store.companies].sort((a, b) => a.name.localeCompare(b.name));
  const incomeCategories = state.store.categories.filter((category) => category.type === 'income');
  const expenseCategories = state.store.categories.filter((category) => category.type === 'expense');
  return `<div class="grid-2"><section class="panel"><div class="panel-header"><div><h2>Companies &amp; sources</h2><p>Reusable names for utilities, vendors, clients, employers, and income sources.</p></div><div class="report-actions"><button class="primary-button" data-action="add-company">＋ Add new</button></div></div><div class="panel-body"><details class="danger-details"><summary>Advanced data cleanup</summary><p class="muted">Use only during setup cleanup. This removes every company/source entry and requires two confirmations. It is blocked while transactions reference companies.</p><button class="danger-button" data-action="clear-companies">Clear company data</button></details>${companies.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Name</th><th>Classification</th><th>Contact</th><th>Actions</th></tr></thead><tbody>${companies.map((company) => { const address = [company.mailingAddress1, company.mailingAddress2, [company.mailingCity, company.mailingState, company.mailingPostalCode].filter(Boolean).join(', ')].filter(Boolean).join(' · '); return `<tr><td><strong>${escapeHtml(company.name)}</strong>${company.alwaysHomeOfficeRelated ? '<br><span class="muted">Always marks home office</span>' : ''}${address ? `<br><span class="muted">${escapeHtml(address)}</span>` : ''}${company.notes ? `<br><span class="muted">${escapeHtml(company.notes)}</span>` : ''}</td><td><span class="tag">${escapeHtml(company.classification)}</span></td><td>${escapeHtml(company.phone || company.email || '—')}</td><td class="row-actions"><button class="icon-button" data-action="edit-company" data-id="${escapeAttr(company.id)}">Edit</button><button class="icon-button danger-text" data-action="delete-company" data-id="${escapeAttr(company.id)}">Delete</button></td></tr>`; }).join('')}</tbody></table></div>` : emptyState('No companies or sources yet', 'Add your utility companies and income sources here, or create them while entering a transaction.')}</div></section>
  <section class="panel"><div class="panel-header"><div><h2>Categories</h2><p>Keep labels that make sense to you and your preparer.</p></div></div><div class="panel-body"><form id="category-form"><div class="grid-2"><div class="field"><label class="required" for="category-type">Type</label><select id="category-type" name="type"><option value="expense">Expense</option><option value="income">Income</option></select></div><div class="field"><label class="required" for="category-name">New category</label><input id="category-name" name="name" required maxlength="80" placeholder="e.g. Equipment"></div></div><div class="form-actions"><button type="submit" class="secondary-button">Add category</button></div></form><h3 style="margin:25px 0 8px;color:var(--navy)">Income categories</h3>${categoryList(incomeCategories)}<h3 style="margin:25px 0 8px;color:var(--navy)">Expense categories</h3>${categoryList(expenseCategories)}</div></section></div>`;
}

function categoryList(categories) { return categories.length ? `<div>${categories.sort((a, b) => a.name.localeCompare(b.name)).map((category) => `<div class="list-item"><div><strong class="${category.active ? '' : 'muted'}">${escapeHtml(category.name)}</strong><span>${category.active ? 'Available in transaction forms' : 'Inactive · existing entries are retained'}</span></div><button class="icon-button" data-action="toggle-category" data-id="${escapeAttr(category.id)}">${category.active ? 'Deactivate' : 'Activate'}</button></div>`).join('')}</div>` : '<p class="muted">No categories.</p>'; }

function renderReports() {
  const summary = calculateSummary(state.store, state.selectedYear);
  const reportNotices = [state.lastPdfPath ? `<div class="notice success" style="margin-top:15px">PDF saved to <strong>${escapeHtml(state.lastPdfPath)}</strong> <button class="icon-button" data-action="open-folder" data-path="${escapeAttr(state.lastPdfPath)}">Show in folder</button></div>` : '', state.lastCsvPath ? `<div class="notice success" style="margin-top:15px">CSV saved to <strong>${escapeHtml(state.lastCsvPath)}</strong> <button class="icon-button" data-action="open-folder" data-path="${escapeAttr(state.lastCsvPath)}">Show in folder</button></div>` : ''].join('');
  const backupNotice = state.lastBackupPath ? `<div class="notice success" style="margin-top:15px">Backup saved to <strong>${escapeHtml(state.lastBackupPath)}</strong> <button class="icon-button" data-action="open-folder" data-path="${escapeAttr(state.lastBackupPath)}">Show in folder</button></div>` : '';
  return `<div class="grid-2"><section class="panel"><div class="panel-header"><div><h2>${selectedYearLabel()} tax-preparer report</h2><p>Summary totals followed by a spreadsheet-style transaction ledger.</p></div></div><div class="panel-body"><div class="report-actions"><button class="primary-button" data-action="export-pdf">Export PDF report</button><button class="secondary-button" data-action="export-csv">Export CSV ledger</button></div>${reportNotices}<p class="report-note" style="margin-top:20px"><strong>Important:</strong> The report shows recorded amounts and your entered business-use percentages. It does not decide what is deductible or complete a tax return.</p></div></section><section class="panel"><div class="panel-header"><div><h2>Backup and restore</h2><p>Keep a copy somewhere safe before sharing your report.</p></div></div><div class="panel-body"><div class="report-actions"><button class="secondary-button" data-action="backup-json">Create JSON backup</button><button class="secondary-button" data-action="restore-json">Restore JSON backup</button></div>${backupNotice}<p class="muted" style="margin-top:18px">The app also keeps a previous local copy automatically when records are saved. Backups contain your companies, categories, and transactions.</p></div></section></div>
  <section class="panel" style="margin-top:20px"><div class="panel-header"><div><h2>Report preview</h2><p>These figures will appear in the PDF summary.</p></div></div><div class="panel-body"><div class="cards" style="margin-bottom:0">${metric('Gross income', money(summary.incomeCents), '', 'accent')}${metric('All expenses', money(summary.expenseCents), '', 'orange')}${metric('Allocated expenses', money(summary.allocatedExpenseCents), '', 'green')}${metric('Home office allocated', money(summary.homeOfficeAllocatedCents), '', 'purple')}</div></div></section>`;
}

function renderCompanionDashboard() {
  const paired = state.companionComputer;
  const request = state.companionRequest;
  const online = Boolean(paired && request && !request.offline);
  const waiting = Boolean(request?.captureAvailable);
  const status = waiting ? 'Capture requested' : online ? 'Connected to your PC' : paired ? 'PC is offline' : 'Not paired yet';
  const statusClass = waiting ? 'is-ready' : online ? 'is-online' : 'is-idle';
  const lastSent = Boolean(state.companionLastSent && paired && !waiting);
  return `<div class="companion-page">
    <section class="companion-hero"><div class="companion-hero-copy"><span class="companion-kicker">TaxMan companion</span><h2>${waiting ? 'Your PC is ready for the bill.' : 'Capture bills without typing.'}</h2><p>${waiting ? 'Take one clear photo here. TaxMan will send it directly to the open transaction on your computer.' : 'Pair this phone once, then send bill photos to TaxMan over your private Wi-Fi.'}</p><div class="companion-status ${statusClass}"><span></span>${escapeHtml(status)}</div></div><div class="companion-mark"><img src="assets/taxman-icon.png" alt=""><span>LOCAL<br>ONLY</span></div></section>
    <section class="companion-card capture-card"><div class="companion-card-heading"><div><span class="companion-label">Quick capture</span><h3>${waiting ? 'Send a bill photo' : lastSent ? 'Photo sent' : 'Ready when you are'}</h3></div><span class="companion-step">01</span></div><button class="companion-capture-button" type="button" data-action="companion-take-photo" ${waiting ? '' : 'disabled'}><span class="camera-glyph">⌾</span><span>${waiting ? 'Take photo' : lastSent ? 'Photo sent' : 'Waiting for PC'}</span></button><p class="companion-help">${waiting ? 'Keep the whole bill in frame and use good light.' : lastSent ? 'Your PC received the image. You can prepare the next one below.' : 'Start Take with phone on your PC to enable the camera.'}</p><input id="companion-photo" type="file" accept="image/*" capture="environment" hidden></section>
    ${lastSent ? `<section class="companion-card next-photo-card"><div class="companion-card-heading"><div><span class="companion-label">Keep going</span><h3>Send another photo</h3></div><span class="companion-step">02</span></div><label class="companion-check"><input id="companion-append-page" type="checkbox" ${state.companionAppendNext ? 'checked' : ''}><span>Add the next photo to the current transaction as another page</span></label><p class="companion-help">Leave this unchecked to start a new bill. TaxMan will open the right place on your PC when the photo arrives.</p><button class="primary-button companion-wide-button" type="button" data-action="companion-send-another">Send Another Photo</button></section>` : ''}
    <section class="companion-card connection-card"><div class="companion-card-heading"><div><span class="companion-label">Your computer</span><h3>${escapeHtml(paired?.computerName || 'No PC paired')}</h3></div><span class="connection-icon">⌁</span></div>${paired ? `<p class="connection-detail"><span class="status-dot"></span>${escapeHtml(paired.deviceName || 'This phone')} is remembered by TaxMan.</p><div class="companion-actions"><button class="secondary-button" data-action="unpair-computer">Remove pairing</button><button class="secondary-button" data-view="transactions">Open ledger</button></div>` : `<p class="connection-detail">Pair once with the code shown in TaxMan on your PC. Your phone will remember the connection.</p><button class="primary-button companion-wide-button" data-action="pair-computer">Pair with PC</button>`}</section>
    <section class="companion-note"><span class="lock-glyph">◆</span><div><strong>Private by design</strong><p>Photos travel directly between this phone and your PC. They are not uploaded to a TaxMan account.</p></div></section>
  </div>`;
}

function renderCompanyModal() {
  const selectedExisting = state.companyModal.selectedExistingId ? findCompany(state.companyModal.selectedExistingId) : null;
  const company = state.companyModal.editId ? findCompany(state.companyModal.editId) : (selectedExisting || {});
  const title = state.companyModal.editId ? 'Edit company or source' : 'Create new company or source';
  const companyName = company.name || state.companyModal.prefillName || '';
  const existingSelector = !state.companyModal.editId ? `<div class="field wide"><label for="existing-company">Use an existing company/source</label><select id="existing-company" name="existingId"><option value="">Create a new company/source…</option>${[...state.store.companies].sort((a, b) => a.name.localeCompare(b.name)).map((item) => `<option value="${escapeAttr(item.id)}" ${item.id === state.companyModal.selectedExistingId ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}</select><small>Choose a saved record to review or update it, or leave this set to create a new one.</small></div>` : '';
  return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-header"><h2 id="modal-title">${title}</h2><button class="close-button" data-action="close-modal" aria-label="Close">×</button></div><div class="modal-body"><form id="company-form"><input type="hidden" name="id" value="${escapeAttr(state.companyModal.editId || '')}"><div class="form-grid">${existingSelector}<div class="field wide"><label class="required" for="company-name">Name</label><input id="company-name" name="name" required maxlength="120" placeholder="e.g. Georgia Power" value="${escapeAttr(companyName)}"></div><div class="field"><label for="company-classification">Classification</label><select id="company-classification" name="classification">${['Utility','Income source','Vendor','Client','Employer','Insurance','Bank','Other'].map((value) => `<option ${value === (company.classification || 'Other') ? 'selected' : ''}>${value}</option>`).join('')}</select></div><div class="field"><label for="company-phone">Phone</label><input id="company-phone" name="phone" maxlength="40" value="${escapeAttr(company.phone || '')}"></div><div class="field"><label for="company-email">Email</label><input id="company-email" name="email" type="email" maxlength="120" value="${escapeAttr(company.email || '')}"></div><div class="field"><label for="company-website">Website</label><input id="company-website" name="website" maxlength="160" value="${escapeAttr(company.website || '')}"></div><div class="field wide"><label for="company-mailing-address1">Mailing address line 1</label><input id="company-mailing-address1" name="mailingAddress1" maxlength="160" placeholder="P.O. Box 250 or street address" value="${escapeAttr(company.mailingAddress1 || '')}"></div><div class="field wide"><label for="company-mailing-address2">Mailing address line 2</label><input id="company-mailing-address2" name="mailingAddress2" maxlength="160" placeholder="Suite, unit, or attention line (optional)" value="${escapeAttr(company.mailingAddress2 || '')}"></div><div class="field"><label for="company-mailing-city">City</label><input id="company-mailing-city" name="mailingCity" maxlength="80" value="${escapeAttr(company.mailingCity || '')}"></div><div class="field"><label for="company-mailing-state">State</label><input id="company-mailing-state" name="mailingState" maxlength="40" value="${escapeAttr(company.mailingState || '')}"></div><div class="field"><label for="company-mailing-postal">ZIP code</label><input id="company-mailing-postal" name="mailingPostalCode" maxlength="20" inputmode="numeric" value="${escapeAttr(company.mailingPostalCode || '')}"></div><div class="field wide"><label for="company-notes">Notes</label><textarea id="company-notes" name="notes" maxlength="500">${escapeHtml(company.notes || '')}</textarea></div><div class="check-field wide"><input id="company-always-home-office" name="alwaysHomeOfficeRelated" type="checkbox" ${company.alwaysHomeOfficeRelated ? 'checked' : ''}><label for="company-always-home-office">Always mark new expenses for this company as home-office-related</label></div></div><div class="modal-actions"><button type="button" class="secondary-button" data-action="close-modal">Cancel</button><button type="submit" class="primary-button">Save company</button></div></form></div></section></div>`;
}

function renderPhonePairingModal() {
  const expires = new Date(state.phonePairing.expiresAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const qrCode = state.phonePairing.qrDataUrl ? `<div class="phone-qr pairing-qr"><img src="${escapeAttr(state.phonePairing.qrDataUrl)}" alt="QR code for pairing your phone with TaxMan"><p>Scan with TaxMan</p></div>` : '';
  const alternateAddresses = (state.phonePairing.alternateUrls || []).map((url) => pairingAddress(url)).filter(Boolean);
  return `<div class="modal-backdrop"><section class="modal pairing-modal" role="dialog" aria-modal="true" aria-labelledby="pairing-title"><div class="modal-header"><div><span class="eyebrow">One-time setup</span><h2 id="pairing-title">Pair a phone with TaxMan</h2></div><button class="close-button" data-action="close-modal" aria-label="Close">×</button></div><div class="modal-body"><div class="pairing-qr-layout">${qrCode}<div class="pairing-qr-copy"><strong>Scan to connect automatically</strong><p>Open TaxMan on your phone, choose <strong>Pair with PC</strong>, then scan this code. The address and one-time code will be entered for you.</p><p class="muted">Both devices must be on the same Wi-Fi network.</p></div></div><div class="pairing-code-card"><span>PAIRING CODE · MANUAL FALLBACK</span><strong>${escapeHtml(state.phonePairing.code)}</strong><small>Expires at ${escapeHtml(expires)}</small></div><div class="field"><label for="pairing-address">PC address</label><input id="pairing-address" readonly value="${escapeAttr(pairingAddress(state.phonePairing.url))}"><small>Use this address and the code above if scanning is not convenient.${alternateAddresses.length ? ` If the phone cannot connect, try ${escapeHtml(alternateAddresses.join(' or '))}.` : ''}</small></div><div class="phone-url-row" style="margin-top:8px"><input id="pairing-url" readonly value="${escapeAttr(state.phonePairing.url)}"><button type="button" class="secondary-button" data-action="copy-pairing-url">Copy</button></div><div class="modal-actions"><button type="button" class="secondary-button" data-action="close-modal">Done</button></div></div></section></div>`;
}

function renderPendingPhonePhotoModal() {
  return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="pending-photo-title"><div class="modal-header"><div><span class="eyebrow">Photo received</span><h2 id="pending-photo-title">Where should this photo go?</h2></div></div><div class="modal-body"><p>Your phone marked this as a new bill, but a transaction is already open on the PC. Choose where to place the newest image before continuing.</p><div class="pending-photo-preview"><img src="${escapeAttr(state.pendingPhonePhoto)}" alt="Newest bill photo"></div><div class="modal-actions"><button type="button" class="secondary-button" data-action="use-pending-photo-current">Add as another page</button><button type="button" class="primary-button" data-action="use-pending-photo-new">Start new bill</button><button type="button" class="danger-button" data-action="discard-pending-photo">Discard photo</button></div></div></section></div>`;
}

function renderCompanionPairingModal() {
  const pairing = state.companionPairingData || {};
  return `<div class="modal-backdrop"><section class="modal companion-pairing-modal" role="dialog" aria-modal="true" aria-labelledby="companion-pair-title"><div class="modal-header"><div><span class="eyebrow">One-time setup</span><h2 id="companion-pair-title">Pair with your TaxMan PC</h2></div><button class="close-button" data-action="cancel-companion-pairing" aria-label="Close">×</button></div><div class="modal-body"><div class="pairing-intro"><div class="pairing-shield">⌁</div><div><strong>Private phone companion</strong><p>Scan the QR code shown in TaxMan on your PC to fill this in automatically.</p></div></div>${pairing.error ? `<div class="notice error"><strong>Connection problem:</strong> ${escapeHtml(pairing.error)}</div>` : ''}<button type="button" class="primary-button pairing-scan-button" data-action="scan-pairing-qr">▣ &nbsp; Scan QR code</button><div class="pairing-divider"><span>or enter manually</span></div><form id="pair-computer-form"><div class="field"><label class="required" for="companion-base-url">PC address</label><input id="companion-base-url" name="baseUrl" required inputmode="url" placeholder="http://192.168.1.12:38741" value="${escapeAttr(pairing.baseUrl || '')}"><small>Both devices must be on the same Wi-Fi.</small></div><div class="field" style="margin-top:14px"><label class="required" for="companion-code">One-time pairing code</label><input id="companion-code" name="code" required inputmode="numeric" pattern="[0-9]{6}" maxlength="6" placeholder="123456" value="${escapeAttr(pairing.code || '')}"></div><div class="field" style="margin-top:14px"><label for="companion-device-name">Phone name</label><input id="companion-device-name" name="deviceName" maxlength="80" value="My Android phone" placeholder="e.g. Phill’s phone"></div><div class="modal-actions"><button type="button" class="secondary-button" data-action="cancel-companion-pairing">Cancel</button><button type="submit" class="primary-button">Pair securely</button></div></form></div></section></div>`;
}

function renderQrScannerModal() {
  return `<div class="modal-backdrop"><section class="modal qr-scanner-modal" role="dialog" aria-modal="true" aria-labelledby="qr-scanner-title"><div class="modal-header"><div><span class="eyebrow">Automatic setup</span><h2 id="qr-scanner-title">Scan the TaxMan code</h2></div><button class="close-button" data-action="close-qr-scanner" aria-label="Close">×</button></div><div class="modal-body"><div class="qr-scanner-frame"><video id="pairing-qr-video" autoplay muted playsinline></video><div class="qr-scanner-target" aria-hidden="true"></div></div><p class="qr-scanner-status">${escapeHtml(state.qrScannerMessage || 'Point your camera at the QR code shown on your PC.')}</p><div class="notice">The phone will connect directly to your PC over Wi-Fi. The code is one-time and expires shortly.</div><div class="modal-actions"><button type="button" class="secondary-button" data-action="close-qr-scanner">Enter details manually</button></div></div></section></div>`;
}

function renderPhoneCaptureModal() {
  const expires = new Date(state.phoneCapture.expiresAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (state.phoneCapture.paired) return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="phone-capture-title"><div class="modal-header"><div><span class="eyebrow">Paired phone</span><h2 id="phone-capture-title">Take a bill photo with your phone</h2></div><button class="close-button" data-action="cancel-phone-capture" aria-label="Close">×</button></div><div class="modal-body"><div class="paired-phone-panel"><span class="paired-phone-badge">● CONNECTED</span><h3>${escapeHtml(state.phoneCapture.deviceName || 'Your Android phone')}</h3><p>Open TaxMan on the phone. It will show this capture request automatically.</p></div><p class="muted">The request expires at ${escapeHtml(expires)}. The photo is sent directly to this computer and held for your review.</p><div class="notice">After the photo arrives, the image appears in the transaction form. Verify every suggested field before saving.</div><div class="modal-actions"><button type="button" class="secondary-button" data-action="unpair-phone">Remove pairing</button><button type="button" class="secondary-button" data-action="cancel-phone-capture">Cancel</button></div></div></section></div>`;
  const qrCode = state.phoneCapture.qrDataUrl ? `<div class="phone-qr"><img src="${escapeAttr(state.phoneCapture.qrDataUrl)}" alt="QR code for opening TaxMan bill photo capture on your phone"><p>Scan with your phone camera</p></div>` : '';
  return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="phone-capture-title"><div class="modal-header"><h2 id="phone-capture-title">Take a bill photo with your phone</h2><button class="close-button" data-action="cancel-phone-capture" aria-label="Close">×</button></div><div class="modal-body"><div class="phone-qr-layout">${qrCode}<div class="phone-qr-instructions"><p>Scan the QR code with your phone while it is connected to the same Wi-Fi as this computer.</p><p class="muted">If scanning is not convenient, open this address manually:</p><div class="phone-url-row"><input id="phone-capture-url" readonly value="${escapeAttr(state.phoneCapture.url)}"><button type="button" class="secondary-button" data-action="copy-phone-url">Copy</button></div></div></div><p class="muted">The link expires at ${escapeHtml(expires)}. The photo is compressed on your phone, sent directly to TaxMan, and held for your review.</p><div class="notice">Pair this phone once to replace the QR step next time.</div><div class="modal-actions"><button type="button" class="primary-button" data-action="pair-phone">Pair phone once</button><button type="button" class="secondary-button" data-action="cancel-phone-capture">Cancel</button></div></div></section></div>`;
}

async function beginPhoneCapture() {
  try {
    state.phoneCapture = await window.taxLedger.startPhoneCapture();
    if (state.phoneCapture?.direct) { state.phoneCapture = null; document.getElementById('receipt-photo')?.click(); return; }
    render();
  } catch (error) { toast(error.message || 'Phone capture could not start.', true); }
}

async function beginPhonePairing() {
  try { state.phonePairing = await window.taxLedger.startPhonePairing(); state.phoneCapture = null; render(); stopPairingWatch(); pairingPollTimer = setInterval(async () => { const paired = await window.taxLedger.getPairedPhone(); if (!paired) return; stopPairingWatch(); state.phonePairing = null; toast(`${paired.deviceName} is paired with TaxMan.`); render(); }, 1800); }
  catch (error) { toast(error.message || 'Phone pairing could not start.', true); }
}

function stopPairingWatch() { if (pairingPollTimer) { clearInterval(pairingPollTimer); pairingPollTimer = null; } }

function pairingAddress(url) { try { const parsed = new URL(url); return `${parsed.protocol}//${parsed.host}`; } catch { return ''; } }

function pairComputer(form) { return pairComputerValues(form.get('baseUrl'), form.get('code'), form.get('deviceName')); }

async function pairComputerValues(baseUrl, code, deviceName) {
  try { const paired = await window.taxLedger.pairWithComputer(baseUrl, code, deviceName); state.companionComputer = paired; state.companionPairing = false; state.companionPairingData = null; toast(`Connected to ${paired.computerName || 'TaxMan on your PC'}.`); startCompanionPolling(); render(); }
  catch (error) { state.companionPairingData = { baseUrl, code, deviceName, error: error.message || 'TaxMan could not pair with this PC.' }; toast(state.companionPairingData.error, true); render(); }
}

async function openPairingQrScanner() {
  if (typeof window.jsQR !== 'function' || !navigator.mediaDevices?.getUserMedia) { toast('QR scanning is not available on this phone. Enter the PC address and code manually.', true); return; }
  state.qrScanner = true;
  state.qrScannerMessage = 'Point your camera at the QR code shown on your PC.';
  render();
  try {
    const video = document.getElementById('pairing-qr-video');
    qrScannerStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    video.srcObject = qrScannerStream;
    await video.play();
    scanPairingQrFrame(video);
  } catch (error) {
    stopQrScanner();
    state.qrScanner = false;
    render();
    toast(error.name === 'NotAllowedError' ? 'Camera access was declined. Allow camera access to scan the PC code.' : 'The camera could not be opened. Enter the PC details manually.', true);
  }
}

function scanPairingQrFrame(video) {
  if (!state.qrScanner || !qrScannerStream) return;
  if (video.readyState >= 2 && video.videoWidth && video.videoHeight) {
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 900 / video.videoWidth);
    canvas.width = Math.max(1, Math.floor(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.floor(video.videoHeight * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const result = window.jsQR(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: 'attemptBoth' });
    if (result?.data) { const pairing = parsePairingQr(result.data); if (pairing) { completePairingFromQr(pairing); return; } state.qrScannerMessage = 'That code is not a TaxMan pairing code. Find the code in the PC pairing window.'; }
  }
  qrScannerFrame = requestAnimationFrame(() => scanPairingQrFrame(video));
}

function parsePairingQr(value) {
  try {
    const parsed = new URL(String(value || ''));
    const code = parsed.searchParams.get('code') || '';
    if (!/^https?:$/.test(parsed.protocol) || parsed.pathname.replace(/\/+$/, '') !== '/pair' || !/^\d{6}$/.test(code)) return null;
    return { baseUrl: `${parsed.protocol}//${parsed.host}`, code };
  } catch { return null; }
}

async function completePairingFromQr(pairing) {
  stopQrScanner();
  state.qrScanner = false;
  await pairComputerValues(pairing.baseUrl, pairing.code, 'My Android phone');
}

function stopQrScanner() {
  if (qrScannerFrame) cancelAnimationFrame(qrScannerFrame);
  qrScannerFrame = null;
  if (qrScannerStream) qrScannerStream.getTracks().forEach((track) => track.stop());
  qrScannerStream = null;
}

function startCompanionPolling() {
  if (!window.taxLedger.isMobileCompanion || companionPollTimer) return;
  const poll = async () => { const result = await window.taxLedger.pollPairedCapture(); state.companionRequest = result; if (result.captureAvailable) state.companionLastSent = false; if (!result.paired) state.companionComputer = null; if (!state.companionPairing && !state.qrScanner && !state.transactionDraft) render(); };
  poll();
  companionPollTimer = setInterval(poll, 2500);
}

async function handleCompanionPhoto(file) {
  try { const imageData = await resizeReceiptImage(file); await window.taxLedger.sendPairedPhoto(imageData); state.companionRequest = { ...(state.companionRequest || {}), captureAvailable: false }; state.companionLastSent = true; toast('Bill photo sent to TaxMan.'); render(); }
  catch (error) { toast(error.message || 'The photo could not be sent.', true); }
}

async function requestAnotherCompanionPhoto() {
  const mode = state.companionAppendNext ? 'append' : 'new';
  try {
    const result = await window.taxLedger.requestAnotherPhoto(mode);
    state.companionAppendNext = false;
    state.companionLastSent = false;
    state.companionRequest = { ...(state.companionRequest || {}), ...result, paired: true, offline: false };
    toast(mode === 'append' ? 'Ready for another page of the current transaction.' : 'Ready for a new bill photo.');
    render();
  } catch (error) { toast(error.message || 'TaxMan could not prepare the next photo.', true); }
}

async function copyPhoneUrl() {
  const url = state.phoneCapture?.url;
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    toast('Phone capture address copied.');
  } catch {
    const input = document.getElementById('phone-capture-url');
    input?.select();
    document.execCommand('copy');
    toast('Phone capture address copied.');
  }
}

async function copyText(value, message) { if (!value) return; try { await navigator.clipboard.writeText(value); toast(message); } catch { toast('Copy was not available.'); } }

function getReceiptImages(draft = {}) {
  const images = Array.isArray(draft.receiptImages) ? draft.receiptImages.filter((image) => /^data:image\/(?:jpeg|png|webp);base64,/.test(String(image))) : [];
  if (!images.length && /^data:image\/(?:jpeg|png|webp);base64,/.test(String(draft.receiptImageData || ''))) images.push(draft.receiptImageData);
  return images.slice(0, 20);
}

function appendReceiptImage(imageData) {
  if (!state.transactionDraft || !/^data:image\/(?:jpeg|png|webp);base64,/.test(String(imageData || ''))) return;
  const images = getReceiptImages(state.transactionDraft);
  if (images.length >= 20) { toast('A transaction can contain up to 20 bill-photo pages.', true); return; }
  images.push(imageData);
  state.transactionDraft.receiptImages = images;
  state.transactionDraft.receiptImageData = images[0] || '';
}

function removeReceiptImage(index) {
  if (!state.transactionDraft) return;
  const images = getReceiptImages(state.transactionDraft).filter((_image, imageIndex) => imageIndex !== index);
  state.transactionDraft.receiptImages = images;
  state.transactionDraft.receiptImageData = images[0] || '';
  state.ocr = null;
  render();
}

function draftHasData(draft) {
  return Boolean(draft?.date || draft?.companyId || draft?.categoryId || draft?.description || draft?.amountCents || getReceiptImages(draft).length || draft?.notes);
}

function usePendingPhonePhoto(mode) {
  const photo = state.pendingPhonePhoto;
  if (!photo) return;
  if (mode === 'new') {
    state.pendingPhonePhoto = null;
    state.transactionDraft = null;
    openTransaction('expense');
    appendReceiptImage(photo);
    state.ocr = null;
    render();
  } else {
    appendReceiptImage(photo);
    state.pendingPhonePhoto = null;
    state.ocr = null;
    toast('Photo added as another page to the current transaction.');
    render();
  }
}

async function handlePhoneCaptureUploaded(imageData) {
  const pairedPayload = typeof imageData !== 'string';
  const payload = pairedPayload ? imageData || {} : { imageData, mode: 'current' };
  const photo = payload.imageData;
  if (!/^data:image\/(?:jpeg|png|webp);base64,/.test(String(photo || ''))) return;
  if (payload.mode === 'new' && state.transactionDraft && draftHasData(state.transactionDraft)) {
    state.pendingPhonePhoto = photo;
    await window.taxLedger.stopPhoneCapture();
    toast('A new bill photo arrived. Choose where to place it.', true);
    render();
    return;
  }
  if (payload.mode === 'new' || !state.transactionDraft) openTransaction('expense');
  appendReceiptImage(photo);
  state.ocr = null;
  state.phoneCapture = null;
  if (pairedPayload) await window.taxLedger.stopPhoneCapture();
  toast(payload.mode === 'append' ? 'Another bill page received. Review it before saving.' : 'Bill photo received. Review it before saving.');
  render();
}

async function handleReceiptFile(file) {
  try {
    appendReceiptImage(await resizeReceiptImage(file));
    state.ocr = null;
    toast('Bill photo attached. Review it before saving.');
    render();
  } catch (error) { toast(error.message || 'The photo could not be attached.', true); }
}

async function readBillPhoto() {
  const firstPhoto = getReceiptImages(state.transactionDraft)[0];
  if (!firstPhoto || !window.taxLedger.readBillPhoto) return;
  state.ocr = { busy: true, message: 'Reading the bill photo…', text: '' };
  render();
  try {
    const result = await window.taxLedger.readBillPhoto(firstPhoto, state.store);
    const suggestions = result || {};
    const updates = {};
    if (!state.transactionDraft.date && suggestions.date) updates.date = suggestions.date;
    if (!state.transactionDraft.companyId && suggestions.companyId) updates.companyId = suggestions.companyId;
    if (!state.transactionDraft.categoryId && suggestions.categoryId) updates.categoryId = suggestions.categoryId;
    if (!state.transactionDraft.amountCents && suggestions.amountCents) updates.amountCents = suggestions.amountCents;
    Object.assign(state.transactionDraft, updates);
    const count = Object.keys(updates).length;
    const recognizedCompany = suggestions.companyId ? suggestions.vendor : '';
    const addressNote = suggestions.companyAddress && recognizedCompany ? ' The bill also contains a mailing address; review the company record if you want to save it there.' : '';
    state.ocr = { busy: false, message: count ? `Suggested ${count} field${count === 1 ? '' : 's'}${recognizedCompany ? `, including ${recognizedCompany}` : ''} from the bill photo.${addressNote}` : recognizedCompany ? `Recognized ${recognizedCompany}. No other fields were clear enough to suggest.` : 'No clear transaction fields were found. Enter the fields manually and keep the raw text available for review.', vendor: recognizedCompany, text: suggestions.text || '' };
  } catch (error) {
    state.ocr = { busy: false, message: error.message || 'The bill photo could not be read.', vendor: '', text: '' };
  }
  render();
}

function resizeReceiptImage(file) {
  if (!file.type.startsWith('image/')) return Promise.reject(new Error('Choose an image file.'));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('The photo could not be read.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('The photo could not be opened.'));
      image.onload = () => {
        const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', .78));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function openTransaction(type, idValue) {
  state.view = 'transactions';
  if (idValue) { const transaction = state.store.transactions.find((item) => item.id === idValue); state.transactionDraft = { ...transaction }; state.selectedYear = transaction.taxYear; }
  else { state.transactionDraft = { type: type || 'expense', date: '', companyId: '', categoryId: '', description: '', amountCents: 0, businessUsePercent: 100, homeOfficeRelated: false, paidDate: '', notes: '', receiptImages: [], receiptImageData: '' }; }
  state.ocr = null;
  render();
  setTimeout(() => document.getElementById('transaction-date')?.focus(), 0);
}

async function saveTransaction(form) {
  const type = form.get('type');
  const date = parseDateInput(form.get('date'));
  const transactionYear = date ? yearFromDate(date) : null;
  const amountCents = parseAmount(form.get('amount'));
  const percent = type === 'expense' ? Number(form.get('businessUsePercent')) : null;
  const errors = [];
  if (!date) errors.push('Enter a valid date such as 090826 or 09/08/2026.');
  if (!form.get('companyId')) errors.push('Choose a company or source.');
  if (!form.get('categoryId')) errors.push('Choose a category.');
  if (!form.get('description')?.trim()) errors.push('Add a short description.');
  if (!Number.isInteger(amountCents) || amountCents <= 0) errors.push('Enter an amount greater than $0.00.');
  if (type === 'expense' && (!Number.isFinite(percent) || percent < 0 || percent > 100)) errors.push('Business use must be between 0% and 100%.');
  if (errors.length) { toast(errors[0], true); return; }
  const existing = state.transactionDraft.id ? state.store.transactions.find((transaction) => transaction.id === state.transactionDraft.id) : null;
  const receiptImages = getReceiptImages(state.transactionDraft);
  const transaction = { id: existing?.id || `transaction-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, taxYear: transactionYear, date, type, companyId: String(form.get('companyId')), categoryId: String(form.get('categoryId')), description: String(form.get('description')).trim(), amountCents, businessUsePercent: type === 'expense' ? Math.round(percent * 100) / 100 : null, homeOfficeRelated: type === 'expense' && form.get('homeOfficeRelated') === 'on', paidDate: existing?.paidDate || state.transactionDraft.paidDate || '', notes: String(form.get('notes') || '').trim(), receiptImages, receiptImageData: receiptImages[0] || '', createdAt: existing?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
  if (existing) state.store.transactions = state.store.transactions.map((item) => item.id === existing.id ? transaction : item); else state.store.transactions.push(transaction);
  try { await persist(); } catch (error) { toast(error.message || 'Transaction could not be saved.', true); return; }
  state.transactionDraft = null; state.selectedYear = transactionYear; toast(existing ? 'Transaction updated.' : 'Transaction saved.'); render();
}

async function deleteTransaction(idValue) {
  const transaction = state.store.transactions.find((item) => item.id === idValue);
  if (!transaction || !window.confirm(`Delete the ${transaction.type} entry for ${money(transaction.amountCents)}?`)) return;
  state.store.transactions = state.store.transactions.filter((item) => item.id !== idValue); try { await persist(); } catch (error) { toast(error.message || 'Transaction could not be deleted.', true); return; } toast('Transaction deleted.'); render();
}

async function savePayment(form) {
  const paymentDate = parseDateInput(form.get('paidDate'));
  if (!paymentDate) { toast('Enter a valid paid date such as 090826 or 09/08/2026.', true); return; }
  const transaction = state.store.transactions.find((item) => item.id === state.paymentModal?.id);
  if (!transaction) return;
  const updated = { ...transaction, paidDate: paymentDate, updatedAt: new Date().toISOString() };
  state.store.transactions = state.store.transactions.map((item) => item.id === updated.id ? updated : item);
  if (state.transactionDraft?.id === updated.id) state.transactionDraft.paidDate = paymentDate;
  try { await persist(); } catch (error) { toast(error.message || 'Payment status could not be saved.', true); return; }
  state.paymentModal = null;
  toast('Payment marked paid.');
  render();
}

function calculateTimeBusinessUsePercent(workTime = {}) {
  const hoursPerDay = Number(workTime.hoursPerDay);
  const daysPerWeek = Number(workTime.daysPerWeek);
  if (!Number.isFinite(hoursPerDay) || !Number.isFinite(daysPerWeek)) return 0;
  return Math.round(Math.max(0, Math.min(100, hoursPerDay * daysPerWeek / 168 * 100)) * 100) / 100;
}

function updateWorkUsePreview() {
  const hoursInput = document.getElementById('work-hours-per-day');
  const daysInput = document.getElementById('work-days-per-week');
  const percentOutput = document.getElementById('work-use-percent');
  const mathOutput = document.getElementById('work-use-math');
  const amountOutput = document.getElementById('work-use-amount');
  if (!hoursInput || !daysInput || !percentOutput || !mathOutput) return;
  const hoursPerDay = Number(hoursInput.value);
  const daysPerWeek = Number(daysInput.value);
  const percent = calculateTimeBusinessUsePercent({ hoursPerDay, daysPerWeek });
  percentOutput.textContent = formatPercent(percent);
  mathOutput.textContent = `${Number.isFinite(hoursPerDay) ? hoursPerDay : 0} × ${Number.isFinite(daysPerWeek) ? daysPerWeek : 0} = ${Number.isFinite(hoursPerDay * daysPerWeek) ? (hoursPerDay * daysPerWeek).toFixed(2) : '0.00'} work hours ÷ 168 total hours`;
  if (amountOutput && state.transactionDraft?.amountCents) amountOutput.innerHTML = `This would allocate about <strong>${money(Math.round(state.transactionDraft.amountCents * percent / 100))}</strong> of this ${money(state.transactionDraft.amountCents)} transaction.`;
}

async function applyWorkUse(form) {
  const hoursPerDay = Number(form.get('hoursPerDay'));
  const daysPerWeek = Number(form.get('daysPerWeek'));
  if (!Number.isFinite(hoursPerDay) || hoursPerDay < 0 || hoursPerDay > 24 || !Number.isFinite(daysPerWeek) || daysPerWeek < 0 || daysPerWeek > 7) { toast('Enter work time between 0–24 hours per day and 0–7 days per week.', true); return; }
  const workTime = { hoursPerDay, daysPerWeek };
  const percent = calculateTimeBusinessUsePercent(workTime);
  state.store.workTime = workTime;
  state.transactionDraft.businessUsePercent = percent;
  try { await persist(); } catch (error) { toast(error.message || 'Work-time settings could not be saved.', true); return; }
  state.workUseModal = false;
  toast(`Business use set to ${formatPercent(percent)} from ${Number(hoursPerDay * daysPerWeek).toFixed(2)} of 168 weekly hours.`);
  render();
}

async function unmarkPaid() {
  const transaction = state.store.transactions.find((item) => item.id === state.paymentModal?.id);
  if (!transaction || !window.confirm(`Remove the paid date from ${transaction.description}?`)) return;
  const updated = { ...transaction, paidDate: '', updatedAt: new Date().toISOString() };
  state.store.transactions = state.store.transactions.map((item) => item.id === updated.id ? updated : item);
  if (state.transactionDraft?.id === updated.id) state.transactionDraft.paidDate = '';
  try { await persist(); } catch (error) { toast(error.message || 'Payment status could not be changed.', true); return; }
  state.paymentModal = null;
  toast('Payment marked unpaid.');
  render();
}

async function saveCompany(form) {
  const name = String(form.get('name') || '').trim();
  if (!name) { toast('Enter a company or source name.', true); return; }
  const selectedId = String(form.get('id') || form.get('existingId') || state.companyModal.selectedExistingId || '');
  const duplicate = state.store.companies.find((company) => company.name.toLowerCase() === name.toLowerCase() && company.id !== selectedId);
  if (duplicate) { toast('That company or source already exists.', true); return; }
  const existing = state.store.companies.find((company) => company.id === selectedId);
  const company = { id: existing?.id || `company-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name, classification: String(form.get('classification') || 'Other'), phone: String(form.get('phone') || '').trim(), email: String(form.get('email') || '').trim(), website: String(form.get('website') || '').trim(), mailingAddress1: String(form.get('mailingAddress1') || '').trim(), mailingAddress2: String(form.get('mailingAddress2') || '').trim(), mailingCity: String(form.get('mailingCity') || '').trim(), mailingState: String(form.get('mailingState') || '').trim(), mailingPostalCode: String(form.get('mailingPostalCode') || '').trim(), notes: String(form.get('notes') || '').trim(), alwaysHomeOfficeRelated: form.get('alwaysHomeOfficeRelated') === 'on' };
  if (existing) state.store.companies = state.store.companies.map((item) => item.id === existing.id ? company : item); else state.store.companies.push(company);
  try { await persist(); } catch (error) { toast(error.message || 'Company could not be saved.', true); return; }
  const returnToTransaction = state.companyModal.returnToTransaction;
  if (returnToTransaction) { state.transactionDraft.companyId = company.id; if (company.alwaysHomeOfficeRelated && state.transactionDraft.type === 'expense') { state.transactionDraft.homeOfficeRelated = true; state.transactionDraft.businessUsePercent = calculateTimeBusinessUsePercent(state.store.workTime); } state.view = 'transactions'; }
  else state.view = 'companies';
  state.companyModal = null; toast(existing ? 'Company updated.' : 'Company created.'); render();
}

async function deleteCompany(idValue) {
  if (state.store.transactions.some((transaction) => transaction.companyId === idValue)) { toast('This company is used by a transaction and cannot be deleted. Edit the transaction first.', true); return; }
  const company = findCompany(idValue); if (!company || !window.confirm(`Delete ${company.name}?`)) return;
  state.store.companies = state.store.companies.filter((item) => item.id !== idValue); try { await persist(); } catch (error) { toast(error.message || 'Company could not be deleted.', true); return; } toast('Company deleted.'); render();
}

async function clearCompanyData() {
  if (state.store.transactions.length) { toast('Company data cannot be cleared while transactions reference companies. Remove those test transactions first, or restore a clean backup.', true); return; }
  if (!state.store.companies.length || !window.confirm('This will permanently clear ALL company and source entries. Continue?')) return;
  const confirmation = window.prompt('Final confirmation: type DELETE ALL COMPANY DATA exactly to continue.');
  if (confirmation !== 'DELETE ALL COMPANY DATA') { toast('Company data was not cleared. Confirmation text did not match.', true); return; }
  state.store.companies = [];
  try { await persist(); } catch (error) { toast(error.message || 'Company data could not be cleared.', true); return; }
  toast('Company data cleared.'); render();
}

async function saveCategory(form) {
  const type = String(form.get('type')); const name = String(form.get('name') || '').trim();
  if (!name) { toast('Enter a category name.', true); return; }
  if (state.store.categories.some((category) => category.type === type && category.name.toLowerCase() === name.toLowerCase())) { toast('That category already exists.', true); return; }
  state.store.categories.push({ id: `category-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type, name, active: true }); try { await persist(); } catch (error) { toast(error.message || 'Category could not be added.', true); return; } toast('Category added.'); render();
}

async function toggleCategory(idValue) { const category = findCategory(idValue); if (!category) return; category.active = !category.active; try { await persist(); } catch (error) { toast(error.message || 'Category could not be updated.', true); return; } toast(category.active ? 'Category activated.' : 'Category deactivated.'); render(); }

async function persist() { state.store = await window.taxLedger.saveStore(state.store); }

async function saveLedger() {
  try { await persist(); toast('Ledger saved locally.'); }
  catch (error) { toast(error.message || 'Ledger could not be saved.', true); }
}

async function exportFile(kind) {
  try { const result = kind === 'pdf' ? await window.taxLedger.exportPdf(state.store, state.selectedYear) : kind === 'csv' ? await window.taxLedger.exportCsv(state.store, state.selectedYear) : await window.taxLedger.exportJson(state.store); if (!result.canceled) { if (kind === 'pdf') state.lastPdfPath = result.path; else if (kind === 'csv') state.lastCsvPath = result.path; else state.lastBackupPath = result.path; toast(`${kind.toUpperCase()} saved.`); render(); } } catch (error) { toast(error.message || 'Export failed.', true); }
}

async function restoreJson() {
  const hasRecordedAmounts = state.store.transactions.some((transaction) => Number(transaction.amountCents || 0) > 0);
  const prompt = hasRecordedAmounts
    ? 'Restore a backup? The current ledger will be backed up first, then replaced by the selected file.'
    : 'Restore this backup? The current ledger has no recorded amounts and will be replaced by the selected file.';
  if (!window.confirm(prompt)) return;
  try {
    const result = await window.taxLedger.importJson();
    if (!result.canceled) {
      const importedStore = result.store;
      const savedStore = await window.taxLedger.saveStore(importedStore);
      state.store = savedStore && Array.isArray(savedStore.transactions) ? savedStore : importedStore;
      state.selectedYear = bestYearForStore(state.store, state.store.taxYear || 2025);
      state.lastPdfPath = '';
      state.lastCsvPath = '';
      state.lastBackupPath = '';
      toast('Backup restored.');
      render();
    }
  } catch (error) { toast(error.message || 'Restore failed.', true); }
}

function renderAboutModal() { return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="about-title"><div class="modal-header"><h2 id="about-title">About TaxMan</h2><button class="close-button" data-action="close-modal" aria-label="Close">×</button></div><div class="modal-body"><div style="display:flex;align-items:center;gap:14px;margin-bottom:16px"><img class="brand-icon" src="assets/taxman-icon.png" alt=""><div><strong style="font-size:18px;color:var(--navy)">TaxMan</strong><div class="muted">Version ${escapeHtml(state.appVersion)}</div></div></div><p>A local-first income and expenditure ledger for preparing records for your tax preparer.</p><p class="muted">Your data stays on this computer. This application does not submit tax forms or determine tax treatment.</p><div class="modal-actions"><button type="button" class="primary-button" data-action="close-modal">Close</button></div></div></section></div>`; }

function renderShortcutsModal() { return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="shortcuts-title"><div class="modal-header"><h2 id="shortcuts-title">Keyboard shortcuts</h2><button class="close-button" data-action="close-modal" aria-label="Close">×</button></div><div class="modal-body"><div class="shortcut-list"><div><kbd>Ctrl</kbd> + <kbd>N</kbd><span>New expense</span></div><div><kbd>Ctrl</kbd> + <kbd>S</kbd><span>Save the open transaction</span></div><div><kbd>Ctrl</kbd> + <kbd>1</kbd> through <kbd>4</kbd><span>Open Dashboard, Transactions, Companies, or Reports</span></div><div><kbd>Esc</kbd><span>Close a dialog or cancel the open form</span></div></div><p class="notice" style="margin-top:18px">Date tip: type six digits such as <strong>090826</strong> and the app records September 8, 2026.</p><div class="modal-actions"><button type="button" class="primary-button" data-action="close-modal">Close</button></div></div></section></div>`; }

function handleUpdateStatus(status) {
  if (!status?.message) return;
  if (status.status === 'error') toast(status.message, true);
  else if (status.status === 'not-available') toast(status.message);
  else if (status.status === 'downloaded') toast(status.message);
}

function filteredTransactions() { const search = state.search.toLowerCase(); return [...transactionsForYear(state.store, state.selectedYear)].filter((transaction) => { const company = findCompany(transaction.companyId)?.name || ''; const matchesSearch = !search || [company, transaction.description, transaction.notes].some((value) => value.toLowerCase().includes(search)); return (state.typeFilter === 'all' || transaction.type === state.typeFilter) && (state.categoryFilter === 'all' || transaction.categoryId === state.categoryFilter) && matchesSearch; }).sort((a, b) => b.date.localeCompare(a.date)); }
function companyOptions(selected) { return `<option value="">Choose a company/source</option>${[...state.store.companies].sort((a, b) => a.name.localeCompare(b.name)).map((company) => `<option value="${escapeAttr(company.id)}" ${company.id === selected ? 'selected' : ''}>${escapeHtml(company.name)}${company.alwaysHomeOfficeRelated ? ' · home office default' : ''}</option>`).join('')}<option value="${NEW_COMPANY}">＋ Create new company/source…</option>`; }
function categoryOptions(type, selected) { const categories = state.store.categories.filter((category) => category.type === type && (category.active || category.id === selected)).sort((a, b) => a.name.localeCompare(b.name)); return `<option value="">Choose a category</option>${categories.map((category) => `<option value="${escapeAttr(category.id)}" ${category.id === selected ? 'selected' : ''}>${escapeHtml(category.name)}</option>`).join('')}`; }
function findCompany(idValue) { return state.store.companies.find((company) => company.id === idValue); }
function findCategory(idValue) { return state.store.categories.find((category) => category.id === idValue); }
function businessAmount(transaction) { return transaction.type === 'expense' ? Math.round(transaction.amountCents * Number(transaction.businessUsePercent ?? 100) / 100) : 0; }
function transactionsForYear(store, year) { return store.transactions.filter((transaction) => year === 'all' || transaction.taxYear === Number(year)); }
function selectedYearLabel() { return state.selectedYear === 'all' ? 'All years' : state.selectedYear; }
function calculateSummary(store, year = store.taxYear) { const result = { incomeCents: 0, expenseCents: 0, allocatedExpenseCents: 0, homeOfficeCents: 0, homeOfficeAllocatedCents: 0, homeOfficeCount: 0 }; for (const transaction of transactionsForYear(store, year)) { if (transaction.type === 'income') result.incomeCents += transaction.amountCents; else { result.expenseCents += transaction.amountCents; result.allocatedExpenseCents += businessAmount(transaction); if (transaction.homeOfficeRelated) { result.homeOfficeCents += transaction.amountCents; result.homeOfficeAllocatedCents += businessAmount(transaction); result.homeOfficeCount += 1; } } } result.netBeforeTaxCents = result.incomeCents - result.expenseCents; return result; }
function money(cents) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100); }
function formatPercent(value) { return `${Number(value ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`; }
function parseAmount(value) { const clean = String(value ?? '').replaceAll('$', '').replaceAll(',', '').trim(); if (!/^\d+(\.\d{1,2})?$/.test(clean)) return NaN; return Math.round(Number(clean) * 100); }
function yearFromDate(value) { return Number(String(value).slice(0, 4)); }
function todayIso() { return new Date().toISOString().slice(0, 10); }
function formatDateInput(iso) { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) return ''; const [year, month, day] = iso.split('-'); return `${month}${day}${String(year).slice(-2)}`; }
function formatDateDisplay(iso) { if (!iso) return '—'; const [year, month, day] = iso.split('-'); return `${month}/${day}/${year}`; }
function parseDateInput(value) { const raw = String(value || '').trim(); let iso = raw; const digits = raw.replace(/\D/g, ''); if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) { if (digits.length === 6) iso = `20${digits.slice(4, 6)}-${digits.slice(0, 2)}-${digits.slice(2, 4)}`; else if (digits.length === 8 && digits.slice(0, 4) >= '1900') iso = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`; else if (digits.length === 8) iso = `${digits.slice(4, 8)}-${digits.slice(0, 2)}-${digits.slice(2, 4)}`; else return null; } const parsed = new Date(`${iso}T00:00:00Z`); return /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso ? iso : null; }
function escapeHtml(value) { return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }
function escapeAttr(value) { return escapeHtml(value); }
function emptyState(title, text) { return `<div class="empty"><strong>${title}</strong>${text}</div>`; }
function focusInput(idValue, value) { const input = document.getElementById(idValue); if (input) { input.focus(); input.setSelectionRange(value.length, value.length); } }
function toast(message, error = false) { const region = document.getElementById('toast-region'); const item = document.createElement('div'); item.className = `toast${error ? ' error' : ''}`; item.textContent = message; region.appendChild(item); setTimeout(() => item.remove(), 3500); }

'use strict';

const TAX_YEAR = 2025;
const NEW_COMPANY = '__create__';
const state = { store: null, view: 'dashboard', selectedYear: 2025, transactionDraft: null, companyModal: null, aboutOpen: false, shortcutsOpen: false, openMenu: null, appVersion: '0.2.1', search: '', typeFilter: 'all', categoryFilter: 'all', lastPdfPath: '', lastCsvPath: '', lastBackupPath: '' };

document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  try { state.store = await window.taxLedger.loadStore(); state.selectedYear = state.store.taxYear || 2025; state.appVersion = await window.taxLedger.getVersion(); render(); }
  catch (error) { renderFatal(error); }
});

function bindEvents() {
  document.addEventListener('click', async (event) => {
    const nav = event.target.closest('[data-view]');
    if (nav) { state.view = nav.dataset.view; state.openMenu = null; if (state.view !== 'transactions') state.transactionDraft = null; render(); return; }
    const menu = event.target.closest('[data-menu]');
    if (menu) { state.openMenu = state.openMenu === menu.dataset.menu ? null : menu.dataset.menu; render(); return; }
    const action = event.target.closest('[data-action]');
    if (!action) return;
    await handleAction(action.dataset.action, action);
  });
  document.addEventListener('mouseover', (event) => {
    const menu = event.target.closest('[data-menu]');
    if (menu && state.openMenu && state.openMenu !== menu.dataset.menu) { state.openMenu = menu.dataset.menu; render(); }
  });
  document.addEventListener('submit', async (event) => {
    const formId = event.target?.getAttribute?.('id');
    if (formId === 'transaction-form') { event.preventDefault(); await saveTransaction(new FormData(event.target)); }
    if (formId === 'company-form') { event.preventDefault(); await saveCompany(new FormData(event.target)); }
    if (formId === 'category-form') { event.preventDefault(); await saveCategory(new FormData(event.target)); }
  });
  document.addEventListener('change', (event) => {
    if (event.target.id === 'year-select') { state.selectedYear = Number(event.target.value); render(); }
    if (event.target.id === 'transaction-type') {
      state.transactionDraft.type = event.target.value;
      state.transactionDraft.categoryId = '';
      render();
    }
    if (event.target.id === 'transaction-company' && event.target.value === NEW_COMPANY) {
      state.companyModal = { editId: null, returnToTransaction: true };
      render();
    }
    if (event.target.id === 'home-office-related' && event.target.checked) {
      const businessUse = document.getElementById('business-use');
      if (businessUse) businessUse.value = '33';
    }
  });
  document.addEventListener('input', (event) => {
    if (event.target.id === 'transaction-search') { state.search = event.target.value; render(); focusInput('transaction-search', state.search); }
    if (event.target.id === 'type-filter') { state.typeFilter = event.target.value; render(); }
    if (event.target.id === 'category-filter') { state.categoryFilter = event.target.value; render(); }
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
    else if (event.key === 'Escape') { if (state.companyModal || state.aboutOpen || state.shortcutsOpen) { state.companyModal = null; state.aboutOpen = false; state.shortcutsOpen = false; render(); } else if (state.transactionDraft) { state.transactionDraft = null; render(); } else if (state.openMenu) { state.openMenu = null; render(); } }
  });
}

async function handleAction(action, element) {
  if (action === 'show-add') openTransaction('expense');
  if (action === 'show-add-income') openTransaction('income');
  if (action === 'cancel-form') { state.transactionDraft = null; render(); }
  if (action === 'edit-transaction') openTransaction('', element.dataset.id);
  if (action === 'delete-transaction') await deleteTransaction(element.dataset.id);
  if (action === 'add-company') { state.companyModal = { editId: null, returnToTransaction: false }; render(); }
  if (action === 'edit-company') { state.companyModal = { editId: element.dataset.id, returnToTransaction: false }; render(); }
  if (action === 'close-modal') { state.companyModal = null; state.aboutOpen = false; state.shortcutsOpen = false; render(); }
  if (action === 'show-about') { state.openMenu = null; state.aboutOpen = true; render(); }
  if (action === 'show-shortcuts') { state.openMenu = null; state.shortcutsOpen = true; render(); }
  if (action === 'file-save') await saveLedger();
  if (action === 'file-save-as') await exportFile('json');
  if (action === 'use-today') { const input = document.getElementById('transaction-date'); if (input) { input.value = formatDateInput(todayIso()); input.focus(); } }
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
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === state.view));
  document.getElementById('page-title').textContent = titles[state.view];
  document.getElementById('year-eyebrow').textContent = `${state.selectedYear} tax preparation`;
  populateYearSelector();
  document.getElementById('view-root').innerHTML = state.view === 'dashboard' ? renderDashboard() : state.view === 'transactions' ? renderTransactions() : state.view === 'companies' ? renderCompanies() : renderReports();
  document.querySelectorAll('[data-menu-popup]').forEach((popup) => { popup.hidden = popup.dataset.menuPopup !== state.openMenu; });
  document.getElementById('modal-root').innerHTML = state.companyModal ? renderCompanyModal() : state.aboutOpen ? renderAboutModal() : state.shortcutsOpen ? renderShortcutsModal() : '';
}

function populateYearSelector() {
  const select = document.getElementById('year-select');
  if (!select) return;
  const years = new Set([2024, 2025, 2026, 2027, new Date().getFullYear(), ...state.store.transactions.map((transaction) => transaction.taxYear)]);
  select.innerHTML = [...years].filter((year) => Number.isInteger(year)).sort((a, b) => a - b).map((year) => `<option value="${year}" ${Number(year) === Number(state.selectedYear) ? 'selected' : ''}>${year}</option>`).join('');
}

function renderFatal(error) {
  document.getElementById('view-root').innerHTML = `<section class="panel"><div class="panel-body"><h2>Tax Ledger could not load</h2><p>${escapeHtml(error.message || error)}</p><p class="muted">Your records were not changed. Close and reopen the app, then try again.</p></div></section>`;
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
  <section class="panel" style="margin-top:20px"><div class="panel-header"><div><h2>Recent transactions</h2><p>${state.store.transactions.length ? 'Your latest recorded activity.' : 'No entries yet.'}</p></div><button class="secondary-button" data-view="transactions">See all transactions</button></div>${recent.length ? transactionTable(recent, false) : emptyState('Start with your first entry', 'Use Add transaction to record income or an expense.')}</section>`;
}

function metric(label, value, note, tone) { return `<section class="panel metric-card ${tone}"><div class="metric-label">${label}</div><div class="metric-value">${value}</div><div class="metric-note">${note}</div></section>`; }

function renderTransactions() {
  if (state.transactionDraft) return renderTransactionForm();
  const filtered = filteredTransactions();
  const categories = [...state.store.categories].filter((category) => category.active).sort((a, b) => a.name.localeCompare(b.name));
  return `<section class="panel"><div class="panel-header"><div><h2>${state.selectedYear} transaction ledger</h2><p>One clear record for every income and business-related expense.</p></div><div class="report-actions"><button class="secondary-button" data-action="show-add-income">＋ Income</button><button class="primary-button" data-action="show-add">＋ Expense</button></div></div>
    <div class="panel-body"><div class="filters"><input id="transaction-search" type="search" placeholder="Search company, description, or notes" value="${escapeAttr(state.search)}"><select id="type-filter"><option value="all" ${state.typeFilter === 'all' ? 'selected' : ''}>All types</option><option value="income" ${state.typeFilter === 'income' ? 'selected' : ''}>Income</option><option value="expense" ${state.typeFilter === 'expense' ? 'selected' : ''}>Expense</option></select><select id="category-filter"><option value="all">All categories</option>${categories.map((category) => `<option value="${escapeAttr(category.id)}" ${state.categoryFilter === category.id ? 'selected' : ''}>${escapeHtml(category.name)}</option>`).join('')}</select><span class="muted">${filtered.length} of ${transactionsForYear(state.store, state.selectedYear).length} entries</span></div></div>${filtered.length ? transactionTable(filtered, true) : emptyState('No matching transactions', 'Try clearing a filter or add a new entry.')}</section>`;
}

function renderTransactionForm() {
  const draft = state.transactionDraft;
  const isIncome = draft.type === 'income';
  return `<section class="panel form-panel"><div class="panel-body"><div class="form-title"><div><h2>${draft.id ? 'Edit transaction' : 'Add transaction'}</h2><p>Enter one income or expense item. Amounts are stored in U.S. dollars.</p></div><button class="icon-button" data-action="cancel-form" aria-label="Close form">✕</button></div><div class="entry-tip"><strong>Quick entry:</strong> Type dates as 090826. Ctrl+S saves, Esc cancels, and Ctrl+N starts a new expense.</div><form id="transaction-form"><div class="form-grid compact-form-grid">
    <div class="field date-field"><label class="required" for="transaction-date">Date</label><div class="inline-field"><input id="transaction-date" name="date" type="text" inputmode="numeric" autocomplete="off" placeholder="MMDDYY or MM/DD/YYYY" required value="${escapeAttr(formatDateInput(draft.date || ''))}"><button type="button" class="secondary-button compact-button" data-action="use-today">Today</button></div><small>Examples: 090826 or 09/08/2026. Any valid year is accepted.</small></div>
    <div class="field"><label class="required" for="transaction-type">Income or expense</label><select id="transaction-type" name="type"><option value="income" ${isIncome ? 'selected' : ''}>Income</option><option value="expense" ${!isIncome ? 'selected' : ''}>Expense</option></select></div>
    <div class="field"><label class="required" for="transaction-company">Company or source</label><select id="transaction-company" name="companyId" required>${companyOptions(draft.companyId)}</select><small>Choose “Create new…” to add a company without leaving this form.</small></div>
    <div class="field"><label class="required" for="transaction-category">${isIncome ? 'Income source' : 'Expense category'}</label><select id="transaction-category" name="categoryId" required>${categoryOptions(draft.type, draft.categoryId)}</select></div>
    <div class="field"><label class="required" for="transaction-description">Description</label><input id="transaction-description" name="description" required maxlength="160" placeholder="What was this for?" value="${escapeAttr(draft.description)}"></div>
    <div class="field"><label class="required" for="transaction-amount">Amount (USD)</label><input id="transaction-amount" name="amount" inputmode="decimal" required placeholder="0.00" value="${escapeAttr(draft.amountCents ? (draft.amountCents / 100).toFixed(2) : '')}"><small>Enter the full amount paid or received.</small></div>
    ${isIncome ? '' : `<div class="field"><label class="required" for="business-use">Business use</label><input id="business-use" name="businessUsePercent" type="number" min="0" max="100" step="0.01" required value="${escapeAttr(draft.businessUsePercent ?? 100)}"><small>Use 100% for a fully business expense; shared costs can use a lower percentage.</small></div><div class="check-field"><input id="home-office-related" name="homeOfficeRelated" type="checkbox" ${draft.homeOfficeRelated ? 'checked' : ''}><label for="home-office-related">Mark as home-office-related</label></div>`}
    <div class="field wide"><label for="transaction-notes">Notes</label><textarea id="transaction-notes" name="notes" maxlength="500" placeholder="Optional receipt reference or context">${escapeHtml(draft.notes)}</textarea></div>
  </div><div class="form-actions"><button type="button" class="secondary-button" data-action="cancel-form">Cancel</button><button type="submit" class="primary-button">Save transaction</button></div></form></div></section>`;
}

function transactionTable(items, actions) {
  const rows = items.map((transaction) => {
    const company = findCompany(transaction.companyId)?.name || 'Unknown company';
    const category = findCategory(transaction.categoryId)?.name || 'Unknown category';
    const allocated = transaction.type === 'expense' ? businessAmount(transaction) : 0;
  return `<tr><td>${escapeHtml(formatDateDisplay(transaction.date))}</td><td><span class="type-pill ${transaction.type === 'income' ? 'type-income' : 'type-expense'}">${transaction.type === 'income' ? 'Income' : 'Expense'}</span></td><td><strong>${escapeHtml(company)}</strong><br><span class="muted">${escapeHtml(category)}</span></td><td>${escapeHtml(transaction.description)}${transaction.homeOfficeRelated ? '<br><span class="tag">Home office</span>' : ''}</td><td class="money">${money(transaction.amountCents)}</td><td class="money">${transaction.type === 'expense' ? `${formatPercent(transaction.businessUsePercent)}<br><span class="muted">${money(allocated)}</span>` : '—'}</td>${actions ? `<td class="row-actions"><button class="icon-button" data-action="edit-transaction" data-id="${escapeAttr(transaction.id)}" title="Edit">Edit</button><button class="icon-button danger-text" data-action="delete-transaction" data-id="${escapeAttr(transaction.id)}" title="Delete">Delete</button></td>` : ''}</tr>`;
  }).join('');
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Type</th><th>Company/source &amp; category</th><th>Description</th><th>Amount</th><th>Business use<br>Allocated</th>${actions ? '<th>Actions</th>' : ''}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderCompanies() {
  const companies = [...state.store.companies].sort((a, b) => a.name.localeCompare(b.name));
  const incomeCategories = state.store.categories.filter((category) => category.type === 'income');
  const expenseCategories = state.store.categories.filter((category) => category.type === 'expense');
  return `<div class="grid-2"><section class="panel"><div class="panel-header"><div><h2>Companies &amp; sources</h2><p>Reusable names for utilities, vendors, clients, employers, and income sources.</p></div><div class="report-actions"><button class="primary-button" data-action="add-company">＋ Add new</button></div></div><div class="panel-body"><details class="danger-details"><summary>Advanced data cleanup</summary><p class="muted">Use only during setup cleanup. This removes every company/source entry and requires two confirmations. It is blocked while transactions reference companies.</p><button class="danger-button" data-action="clear-companies">Clear company data</button></details>${companies.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Name</th><th>Classification</th><th>Contact</th><th>Actions</th></tr></thead><tbody>${companies.map((company) => `<tr><td><strong>${escapeHtml(company.name)}</strong>${company.notes ? `<br><span class="muted">${escapeHtml(company.notes)}</span>` : ''}</td><td><span class="tag">${escapeHtml(company.classification)}</span></td><td>${escapeHtml(company.phone || company.email || '—')}</td><td class="row-actions"><button class="icon-button" data-action="edit-company" data-id="${escapeAttr(company.id)}">Edit</button><button class="icon-button danger-text" data-action="delete-company" data-id="${escapeAttr(company.id)}">Delete</button></td></tr>`).join('')}</tbody></table></div>` : emptyState('No companies or sources yet', 'Add your utility companies and income sources here, or create them while entering a transaction.')}</div></section>
  <section class="panel"><div class="panel-header"><div><h2>Categories</h2><p>Keep labels that make sense to you and your preparer.</p></div></div><div class="panel-body"><form id="category-form"><div class="grid-2"><div class="field"><label class="required" for="category-type">Type</label><select id="category-type" name="type"><option value="expense">Expense</option><option value="income">Income</option></select></div><div class="field"><label class="required" for="category-name">New category</label><input id="category-name" name="name" required maxlength="80" placeholder="e.g. Equipment"></div></div><div class="form-actions"><button type="submit" class="secondary-button">Add category</button></div></form><h3 style="margin:25px 0 8px;color:var(--navy)">Income categories</h3>${categoryList(incomeCategories)}<h3 style="margin:25px 0 8px;color:var(--navy)">Expense categories</h3>${categoryList(expenseCategories)}</div></section></div>`;
}

function categoryList(categories) { return categories.length ? `<div>${categories.sort((a, b) => a.name.localeCompare(b.name)).map((category) => `<div class="list-item"><div><strong class="${category.active ? '' : 'muted'}">${escapeHtml(category.name)}</strong><span>${category.active ? 'Available in transaction forms' : 'Inactive · existing entries are retained'}</span></div><button class="icon-button" data-action="toggle-category" data-id="${escapeAttr(category.id)}">${category.active ? 'Deactivate' : 'Activate'}</button></div>`).join('')}</div>` : '<p class="muted">No categories.</p>'; }

function renderReports() {
  const summary = calculateSummary(state.store, state.selectedYear);
  const reportNotices = [state.lastPdfPath ? `<div class="notice success" style="margin-top:15px">PDF saved to <strong>${escapeHtml(state.lastPdfPath)}</strong> <button class="icon-button" data-action="open-folder" data-path="${escapeAttr(state.lastPdfPath)}">Show in folder</button></div>` : '', state.lastCsvPath ? `<div class="notice success" style="margin-top:15px">CSV saved to <strong>${escapeHtml(state.lastCsvPath)}</strong> <button class="icon-button" data-action="open-folder" data-path="${escapeAttr(state.lastCsvPath)}">Show in folder</button></div>` : ''].join('');
  const backupNotice = state.lastBackupPath ? `<div class="notice success" style="margin-top:15px">Backup saved to <strong>${escapeHtml(state.lastBackupPath)}</strong> <button class="icon-button" data-action="open-folder" data-path="${escapeAttr(state.lastBackupPath)}">Show in folder</button></div>` : '';
  return `<div class="grid-2"><section class="panel"><div class="panel-header"><div><h2>${state.selectedYear} tax-preparer report</h2><p>Summary totals followed by a spreadsheet-style transaction ledger.</p></div></div><div class="panel-body"><div class="report-actions"><button class="primary-button" data-action="export-pdf">Export PDF report</button><button class="secondary-button" data-action="export-csv">Export CSV ledger</button></div>${reportNotices}<p class="report-note" style="margin-top:20px"><strong>Important:</strong> The report shows recorded amounts and your entered business-use percentages. It does not decide what is deductible or complete a tax return.</p></div></section><section class="panel"><div class="panel-header"><div><h2>Backup and restore</h2><p>Keep a copy somewhere safe before sharing your report.</p></div></div><div class="panel-body"><div class="report-actions"><button class="secondary-button" data-action="backup-json">Create JSON backup</button><button class="secondary-button" data-action="restore-json">Restore JSON backup</button></div>${backupNotice}<p class="muted" style="margin-top:18px">The app also keeps a previous local copy automatically when records are saved. Backups contain your companies, categories, and transactions.</p></div></section></div>
  <section class="panel" style="margin-top:20px"><div class="panel-header"><div><h2>Report preview</h2><p>These figures will appear in the PDF summary.</p></div></div><div class="panel-body"><div class="cards" style="margin-bottom:0">${metric('Gross income', money(summary.incomeCents), '', 'accent')}${metric('All expenses', money(summary.expenseCents), '', 'orange')}${metric('Allocated expenses', money(summary.allocatedExpenseCents), '', 'green')}${metric('Home office allocated', money(summary.homeOfficeAllocatedCents), '', 'purple')}</div></div></section>`;
}

function renderCompanyModal() {
  const company = state.companyModal.editId ? findCompany(state.companyModal.editId) : {};
  const title = state.companyModal.editId ? 'Edit company or source' : 'Create new company or source';
  return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-header"><h2 id="modal-title">${title}</h2><button class="close-button" data-action="close-modal" aria-label="Close">×</button></div><div class="modal-body"><form id="company-form"><input type="hidden" name="id" value="${escapeAttr(company.id || '')}"><div class="form-grid"><div class="field wide"><label class="required" for="company-name">Name</label><input id="company-name" name="name" required maxlength="120" placeholder="e.g. Georgia Power" value="${escapeAttr(company.name || '')}"></div><div class="field"><label for="company-classification">Classification</label><select id="company-classification" name="classification">${['Utility','Income source','Vendor','Client','Employer','Insurance','Bank','Other'].map((value) => `<option ${value === (company.classification || 'Other') ? 'selected' : ''}>${value}</option>`).join('')}</select></div><div class="field"><label for="company-phone">Phone</label><input id="company-phone" name="phone" maxlength="40" value="${escapeAttr(company.phone || '')}"></div><div class="field"><label for="company-email">Email</label><input id="company-email" name="email" type="email" maxlength="120" value="${escapeAttr(company.email || '')}"></div><div class="field"><label for="company-website">Website</label><input id="company-website" name="website" maxlength="160" value="${escapeAttr(company.website || '')}"></div><div class="field wide"><label for="company-notes">Notes</label><textarea id="company-notes" name="notes" maxlength="500">${escapeHtml(company.notes || '')}</textarea></div></div><div class="modal-actions"><button type="button" class="secondary-button" data-action="close-modal">Cancel</button><button type="submit" class="primary-button">Save company</button></div></form></div></section></div>`;
}

function openTransaction(type, idValue) {
  state.view = 'transactions';
  if (idValue) { const transaction = state.store.transactions.find((item) => item.id === idValue); state.transactionDraft = { ...transaction }; state.selectedYear = transaction.taxYear; }
  else { state.transactionDraft = { type: type || 'expense', date: '', companyId: '', categoryId: '', description: '', amountCents: 0, businessUsePercent: 100, homeOfficeRelated: false, notes: '' }; }
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
  const transaction = { id: existing?.id || `transaction-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, taxYear: transactionYear, date, type, companyId: String(form.get('companyId')), categoryId: String(form.get('categoryId')), description: String(form.get('description')).trim(), amountCents, businessUsePercent: type === 'expense' ? Math.round(percent * 100) / 100 : null, homeOfficeRelated: type === 'expense' && form.get('homeOfficeRelated') === 'on', notes: String(form.get('notes') || '').trim(), createdAt: existing?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
  if (existing) state.store.transactions = state.store.transactions.map((item) => item.id === existing.id ? transaction : item); else state.store.transactions.push(transaction);
  try { await persist(); } catch (error) { toast(error.message || 'Transaction could not be saved.', true); return; }
  state.transactionDraft = null; state.selectedYear = transactionYear; toast(existing ? 'Transaction updated.' : 'Transaction saved.'); render();
}

async function deleteTransaction(idValue) {
  const transaction = state.store.transactions.find((item) => item.id === idValue);
  if (!transaction || !window.confirm(`Delete the ${transaction.type} entry for ${money(transaction.amountCents)}?`)) return;
  state.store.transactions = state.store.transactions.filter((item) => item.id !== idValue); try { await persist(); } catch (error) { toast(error.message || 'Transaction could not be deleted.', true); return; } toast('Transaction deleted.'); render();
}

async function saveCompany(form) {
  const name = String(form.get('name') || '').trim();
  if (!name) { toast('Enter a company or source name.', true); return; }
  const duplicate = state.store.companies.find((company) => company.name.toLowerCase() === name.toLowerCase() && company.id !== form.get('id'));
  if (duplicate) { toast('That company or source already exists.', true); return; }
  const existing = state.store.companies.find((company) => company.id === form.get('id'));
  const company = { id: existing?.id || `company-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name, classification: String(form.get('classification') || 'Other'), phone: String(form.get('phone') || '').trim(), email: String(form.get('email') || '').trim(), website: String(form.get('website') || '').trim(), notes: String(form.get('notes') || '').trim() };
  if (existing) state.store.companies = state.store.companies.map((item) => item.id === existing.id ? company : item); else state.store.companies.push(company);
  try { await persist(); } catch (error) { toast(error.message || 'Company could not be saved.', true); return; }
  const returnToTransaction = state.companyModal.returnToTransaction;
  if (returnToTransaction) { state.transactionDraft.companyId = company.id; state.view = 'transactions'; }
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
  if (!window.confirm('Restore a backup? The current ledger will be backed up first, then replaced by the selected file.')) return;
  try { const result = await window.taxLedger.importJson(); if (!result.canceled) { state.store = await window.taxLedger.saveStore(result.store); state.selectedYear = state.store.taxYear || 2025; state.lastPdfPath = ''; state.lastCsvPath = ''; state.lastBackupPath = ''; toast('Backup restored.'); render(); } } catch (error) { toast(error.message || 'Restore failed.', true); }
}

function renderAboutModal() { return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="about-title"><div class="modal-header"><h2 id="about-title">About Tax Ledger</h2><button class="close-button" data-action="close-modal" aria-label="Close">×</button></div><div class="modal-body"><div style="display:flex;align-items:center;gap:14px;margin-bottom:16px"><div class="brand-mark">$</div><div><strong style="font-size:18px;color:var(--navy)">Tax Ledger</strong><div class="muted">Version ${escapeHtml(state.appVersion)}</div></div></div><p>A local-first income and expenditure ledger for preparing records for your tax preparer.</p><p class="muted">Your data stays on this computer. This application does not submit tax forms or determine tax treatment.</p><div class="modal-actions"><button type="button" class="primary-button" data-action="close-modal">Close</button></div></div></section></div>`; }

function renderShortcutsModal() { return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="shortcuts-title"><div class="modal-header"><h2 id="shortcuts-title">Keyboard shortcuts</h2><button class="close-button" data-action="close-modal" aria-label="Close">×</button></div><div class="modal-body"><div class="shortcut-list"><div><kbd>Ctrl</kbd> + <kbd>N</kbd><span>New expense</span></div><div><kbd>Ctrl</kbd> + <kbd>S</kbd><span>Save the open transaction</span></div><div><kbd>Ctrl</kbd> + <kbd>1</kbd> through <kbd>4</kbd><span>Open Dashboard, Transactions, Companies, or Reports</span></div><div><kbd>Esc</kbd><span>Close a dialog or cancel the open form</span></div></div><p class="notice" style="margin-top:18px">Date tip: type six digits such as <strong>090826</strong> and the app records September 8, 2026.</p><div class="modal-actions"><button type="button" class="primary-button" data-action="close-modal">Close</button></div></div></section></div>`; }

function filteredTransactions() { const search = state.search.toLowerCase(); return [...state.store.transactions].filter((transaction) => transaction.taxYear === Number(state.selectedYear)).filter((transaction) => { const company = findCompany(transaction.companyId)?.name || ''; const matchesSearch = !search || [company, transaction.description, transaction.notes].some((value) => value.toLowerCase().includes(search)); return (state.typeFilter === 'all' || transaction.type === state.typeFilter) && (state.categoryFilter === 'all' || transaction.categoryId === state.categoryFilter) && matchesSearch; }).sort((a, b) => b.date.localeCompare(a.date)); }
function companyOptions(selected) { return `<option value="">Choose a company/source</option>${[...state.store.companies].sort((a, b) => a.name.localeCompare(b.name)).map((company) => `<option value="${escapeAttr(company.id)}" ${company.id === selected ? 'selected' : ''}>${escapeHtml(company.name)}</option>`).join('')}<option value="${NEW_COMPANY}">＋ Create new company/source…</option>`; }
function categoryOptions(type, selected) { const categories = state.store.categories.filter((category) => category.type === type && (category.active || category.id === selected)).sort((a, b) => a.name.localeCompare(b.name)); return `<option value="">Choose a category</option>${categories.map((category) => `<option value="${escapeAttr(category.id)}" ${category.id === selected ? 'selected' : ''}>${escapeHtml(category.name)}</option>`).join('')}`; }
function findCompany(idValue) { return state.store.companies.find((company) => company.id === idValue); }
function findCategory(idValue) { return state.store.categories.find((category) => category.id === idValue); }
function businessAmount(transaction) { return transaction.type === 'expense' ? Math.round(transaction.amountCents * Number(transaction.businessUsePercent ?? 100) / 100) : 0; }
function transactionsForYear(store, year) { return store.transactions.filter((transaction) => year === 'all' || transaction.taxYear === Number(year)); }
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

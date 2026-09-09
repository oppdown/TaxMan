'use strict';

const TAX_YEAR = 2025;

const DEFAULT_COMPANIES = [
  { id: 'company-hart-emc', name: 'Hart EMC', classification: 'Utility', phone: '', email: '', website: '', notes: '' },
  { id: 'company-att-mobile', name: 'AT&T Mobile', classification: 'Utility', phone: '', email: '', website: '', notes: '' },
  { id: 'company-windstream-internet', name: 'Windstream Internet', classification: 'Utility', phone: '', email: '', website: '', notes: '' },
  { id: 'company-progressive-car-insurance', name: 'Progressive Car Insurance', classification: 'Insurance', phone: '', email: '', website: '', notes: '' },
  { id: 'company-chatgpt', name: 'ChatGPT', classification: 'Vendor', phone: '', email: '', website: '', notes: '' },
  { id: 'company-ne-georgia-bank', name: 'NE Georgia Bank', classification: 'Bank', phone: '', email: '', website: '', notes: 'Banking costs' },
  { id: 'company-city-royston-natural-gas', name: 'City of Royston - Natural Gas', classification: 'Utility', phone: '', email: '', website: '', notes: '' },
  { id: 'company-franklin-county-water', name: 'Franklin County Water Department', classification: 'Utility', phone: '', email: '', website: '', notes: '' },
  { id: 'company-theitsupportcenter', name: 'theITSupportCenter', classification: 'Income source', phone: '', email: '', website: '', notes: '' }
];

const DEFAULT_CATEGORIES = [
  { id: 'income-freelance', type: 'income', name: 'Freelance / 1099', active: true },
  { id: 'income-sales', type: 'income', name: 'Sales', active: true },
  { id: 'income-wages', type: 'income', name: 'Wages', active: true },
  { id: 'income-other', type: 'income', name: 'Interest / Other', active: true },
  { id: 'expense-utilities', type: 'expense', name: 'Utilities', active: true },
  { id: 'expense-internet-phone', type: 'expense', name: 'Internet / Phone', active: true },
  { id: 'expense-office-supplies', type: 'expense', name: 'Office Supplies', active: true },
  { id: 'expense-software', type: 'expense', name: 'Software / Subscriptions', active: true },
  { id: 'expense-advertising', type: 'expense', name: 'Advertising', active: true },
  { id: 'expense-professional-services', type: 'expense', name: 'Professional Services', active: true },
  { id: 'expense-insurance', type: 'expense', name: 'Insurance', active: true },
  { id: 'expense-banking-costs', type: 'expense', name: 'Banking Costs', active: true },
  { id: 'expense-travel-vehicle', type: 'expense', name: 'Travel / Vehicle', active: true },
  { id: 'expense-home-office', type: 'expense', name: 'Home Office', active: true },
  { id: 'expense-other', type: 'expense', name: 'Other', active: true }
];

function nowIso() {
  return new Date().toISOString();
}

function formatDate(value) {
  const [year, month, day] = String(value || '').split('-');
  return year && month && day ? `${month}/${day}/${year}` : String(value || '');
}

function id(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createEmptyStore() {
  return {
    schemaVersion: 1,
    taxYear: TAX_YEAR,
    companies: DEFAULT_COMPANIES.map((company) => ({ ...company })),
    categories: DEFAULT_CATEGORIES.map((category) => ({ ...category })),
    transactions: [],
    updatedAt: nowIso()
  };
}

function cleanText(value) {
  return String(value ?? '').trim();
}

function normalizeStore(input) {
  const base = createEmptyStore();
  const source = input && typeof input === 'object' ? input : {};
  const categories = Array.isArray(source.categories) ? source.categories : base.categories;
  const companies = Array.isArray(source.companies) ? source.companies : base.companies;
  const transactions = Array.isArray(source.transactions) ? source.transactions : [];

  return {
    schemaVersion: 1,
    taxYear: Number.isInteger(source.taxYear) ? source.taxYear : TAX_YEAR,
    companies: companies.map((company) => ({
      id: cleanText(company.id) || id('company'),
      name: cleanText(company.name),
      classification: cleanText(company.classification) || 'Other',
      phone: cleanText(company.phone),
      email: cleanText(company.email),
      website: cleanText(company.website),
      notes: cleanText(company.notes)
    })),
    categories: categories.map((category) => ({
      id: cleanText(category.id) || id('category'),
      type: category.type === 'income' ? 'income' : 'expense',
      name: cleanText(category.name),
      active: category.active !== false
    })),
    transactions: transactions.map((transaction) => ({
      id: cleanText(transaction.id) || id('transaction'),
      taxYear: isValidIsoDate(cleanText(transaction.date)) ? yearFromDate(cleanText(transaction.date)) : (Number.isInteger(transaction.taxYear) ? transaction.taxYear : TAX_YEAR),
      date: cleanText(transaction.date),
      type: transaction.type === 'income' ? 'income' : 'expense',
      companyId: cleanText(transaction.companyId),
      categoryId: cleanText(transaction.categoryId),
      description: cleanText(transaction.description),
      amountCents: Number.isInteger(transaction.amountCents) ? transaction.amountCents : Math.round(Number(transaction.amount || 0) * 100),
      businessUsePercent: transaction.type === 'income' ? null : normalizePercent(transaction.businessUsePercent ?? 100),
      homeOfficeRelated: Boolean(transaction.homeOfficeRelated),
      notes: cleanText(transaction.notes),
      createdAt: cleanText(transaction.createdAt) || nowIso(),
      updatedAt: cleanText(transaction.updatedAt) || nowIso()
    })),
    updatedAt: cleanText(source.updatedAt) || nowIso()
  };
}

function normalizePercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round(Math.max(0, Math.min(100, number)) * 100) / 100;
}

function validateStore(store) {
  const errors = [];
  if (!store || !Number.isInteger(store.taxYear) || store.taxYear < 1900 || store.taxYear > 2100) errors.push('Store tax year must be between 1900 and 2100.');
  const companyIds = new Set((store.companies || []).map((company) => company.id));
  const categoryIds = new Set((store.categories || []).map((category) => category.id));
  for (const transaction of store.transactions || []) {
    if (!isValidIsoDate(transaction.date)) errors.push(`Invalid transaction date: ${transaction.date}`);
    else if (transaction.taxYear !== yearFromDate(transaction.date)) errors.push(`Transaction year does not match its date: ${transaction.id}`);
    if (!['income', 'expense'].includes(transaction.type)) errors.push('Transaction type must be income or expense.');
    if (!companyIds.has(transaction.companyId)) errors.push(`Missing company for transaction ${transaction.id}.`);
    if (!categoryIds.has(transaction.categoryId)) errors.push(`Missing category for transaction ${transaction.id}.`);
    if (!Number.isInteger(transaction.amountCents) || transaction.amountCents <= 0) errors.push(`Invalid amount for transaction ${transaction.id}.`);
    if (transaction.type === 'expense' && (transaction.businessUsePercent < 0 || transaction.businessUsePercent > 100)) errors.push(`Invalid business-use percentage for transaction ${transaction.id}.`);
  }
  return errors;
}

function yearFromDate(value) { return Number(String(value).slice(0, 4)); }

function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return date.toISOString().slice(0, 10) === value;
}

function isValidTaxDate(value) {
  return isValidIsoDate(value) && yearFromDate(value) === TAX_YEAR;
}

function businessAmountCents(transaction) {
  if (transaction.type !== 'expense') return 0;
  return Math.round(transaction.amountCents * normalizePercent(transaction.businessUsePercent ?? 100) / 100);
}

function transactionsForYear(store, year) {
  return store.transactions.filter((transaction) => year === 'all' || transaction.taxYear === Number(year));
}

function calculateSummary(store, year = store.taxYear) {
  const transactions = transactionsForYear(store, year);
  const categories = new Map(store.categories.map((category) => [category.id, category.name]));
  const companies = new Map(store.companies.map((company) => [company.id, company.name]));
  const summary = {
    incomeCents: 0,
    expenseCents: 0,
    allocatedExpenseCents: 0,
    homeOfficeCents: 0,
    homeOfficeAllocatedCents: 0,
    netBeforeTaxCents: 0,
    byCategory: [],
    byCompany: [],
    transactionCount: transactions.length
  };
  const categoryTotals = new Map();
  const companyTotals = new Map();

  for (const transaction of transactions) {
    const amount = transaction.amountCents;
    const businessAmount = businessAmountCents(transaction);
    if (transaction.type === 'income') summary.incomeCents += amount;
    else {
      summary.expenseCents += amount;
      summary.allocatedExpenseCents += businessAmount;
      if (transaction.homeOfficeRelated) {
        summary.homeOfficeCents += amount;
        summary.homeOfficeAllocatedCents += businessAmount;
      }
    }
    const categoryKey = `${transaction.type}:${transaction.categoryId}`;
    const categoryTotal = categoryTotals.get(categoryKey) || { type: transaction.type, categoryId: transaction.categoryId, name: categories.get(transaction.categoryId) || 'Unknown category', amountCents: 0, allocatedCents: 0 };
    categoryTotal.amountCents += amount;
    categoryTotal.allocatedCents += businessAmount;
    categoryTotals.set(categoryKey, categoryTotal);
    const companyTotal = companyTotals.get(transaction.companyId) || { companyId: transaction.companyId, name: companies.get(transaction.companyId) || 'Unknown company', incomeCents: 0, expenseCents: 0 };
    if (transaction.type === 'income') companyTotal.incomeCents += amount;
    else companyTotal.expenseCents += amount;
    companyTotals.set(transaction.companyId, companyTotal);
  }
  summary.netBeforeTaxCents = summary.incomeCents - summary.expenseCents;
  summary.byCategory = [...categoryTotals.values()].sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
  summary.byCompany = [...companyTotals.values()].sort((a, b) => a.name.localeCompare(b.name));
  return summary;
}

function formatCurrency(cents) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);
}

function formatPercent(value) {
  if (value === null || value === undefined) return '—';
  return `${Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function buildReportHtml(store, year = store.taxYear) {
  const transactions = transactionsForYear(store, year);
  const reportStore = { ...store, transactions };
  const summary = calculateSummary(reportStore, year);
  const categoryRows = summary.byCategory.map((row) => `<tr><td>${escapeHtml(row.type === 'income' ? 'Income' : 'Expense')}</td><td>${escapeHtml(row.name)}</td><td class="money">${formatCurrency(row.amountCents)}</td><td class="money">${row.type === 'expense' ? formatCurrency(row.allocatedCents) : '—'}</td></tr>`).join('');
  const companyRows = summary.byCompany.map((row) => `<tr><td>${escapeHtml(row.name)}</td><td class="money">${formatCurrency(row.incomeCents)}</td><td class="money">${formatCurrency(row.expenseCents)}</td></tr>`).join('');
  const transactionRows = [...transactions].sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type)).map((transaction) => {
    const company = store.companies.find((item) => item.id === transaction.companyId)?.name || 'Unknown company';
    const category = store.categories.find((item) => item.id === transaction.categoryId)?.name || 'Unknown category';
    const allocated = transaction.type === 'expense' ? businessAmountCents(transaction) : 0;
    return `<tr><td>${escapeHtml(formatDate(transaction.date))}</td><td>${transaction.type === 'income' ? 'Income' : 'Expense'}</td><td>${escapeHtml(company)}</td><td>${escapeHtml(category)}</td><td>${escapeHtml(transaction.description)}</td><td class="money">${formatCurrency(transaction.amountCents)}</td><td class="money">${formatPercent(transaction.businessUsePercent)}</td><td class="money">${transaction.type === 'expense' ? formatCurrency(allocated) : '—'}</td><td>${transaction.homeOfficeRelated ? 'Yes' : '—'}</td><td>${escapeHtml(transaction.notes)}</td></tr>`;
  }).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: Letter landscape; margin: 0.45in; }
    * { box-sizing: border-box; } body { font-family: Arial, sans-serif; color: #172033; font-size: 9px; margin: 0; }
    h1 { font-size: 24px; margin: 0 0 4px; color: #123b63; } h2 { font-size: 14px; margin: 18px 0 6px; color: #123b63; }
    p { margin: 4px 0; } .muted { color: #5e6b7c; } .summary-page { page-break-after: always; }
    .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 9px; margin: 18px 0; }
    .card { border: 1px solid #ccd7e2; border-radius: 5px; padding: 9px; background: #f5f8fb; } .card .label { color: #5e6b7c; font-size: 8px; text-transform: uppercase; } .card .value { font-weight: bold; font-size: 16px; margin-top: 3px; }
    table { width: 100%; border-collapse: collapse; } thead { display: table-header-group; } th { background: #123b63; color: white; text-align: left; font-size: 8px; } th, td { border: 1px solid #cbd5df; padding: 4px; vertical-align: top; } tr { page-break-inside: avoid; } .money { text-align: right; white-space: nowrap; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; } .notice { margin-top: 18px; padding: 9px; border-left: 4px solid #e59b2f; background: #fff8e8; }
    .ledger th:nth-child(1) { width: 8%; } .ledger th:nth-child(2) { width: 7%; } .ledger th:nth-child(3) { width: 13%; } .ledger th:nth-child(4) { width: 12%; } .ledger th:nth-child(5) { width: 20%; } .ledger th:nth-child(6) { width: 9%; } .ledger th:nth-child(7) { width: 7%; } .ledger th:nth-child(8) { width: 9%; } .ledger th:nth-child(9) { width: 6%; } .ledger th:nth-child(10) { width: 9%; }
  </style></head><body>
    <section class="summary-page"><h1>Tax Ledger ${escapeHtml(String(year))}</h1><p class="muted">Income and expenditure report · Georgia, United States · Generated ${escapeHtml(new Date().toLocaleString('en-US'))}</p>
      <div class="cards"><div class="card"><div class="label">Gross income</div><div class="value">${formatCurrency(summary.incomeCents)}</div></div><div class="card"><div class="label">Total expenses</div><div class="value">${formatCurrency(summary.expenseCents)}</div></div><div class="card"><div class="label">Allocated business expenses</div><div class="value">${formatCurrency(summary.allocatedExpenseCents)}</div></div><div class="card"><div class="label">Net before tax</div><div class="value">${formatCurrency(summary.netBeforeTaxCents)}</div></div></div>
      <h2>Home-office-related costs</h2><table><thead><tr><th>Recorded total</th><th>Allocated business amount</th><th>Entries marked home office</th></tr></thead><tbody><tr><td class="money">${formatCurrency(summary.homeOfficeCents)}</td><td class="money">${formatCurrency(summary.homeOfficeAllocatedCents)}</td><td>${transactions.filter((transaction) => transaction.homeOfficeRelated).length}</td></tr></tbody></table>
      <div class="two-col"><div><h2>Totals by category</h2><table><thead><tr><th>Type</th><th>Category</th><th>Recorded</th><th>Allocated</th></tr></thead><tbody>${categoryRows || '<tr><td colspan="4">No transactions recorded.</td></tr>'}</tbody></table></div><div><h2>Totals by company/source</h2><table><thead><tr><th>Company/source</th><th>Income</th><th>Expense</th></tr></thead><tbody>${companyRows || '<tr><td colspan="3">No transactions recorded.</td></tr>'}</tbody></table></div></div>
      <div class="notice"><strong>Preparers note:</strong> This report reflects the amounts and business-use percentages entered by the user. Final tax treatment, deductibility, depreciation, and federal/Georgia filing decisions must be confirmed by the tax preparer.</div>
    </section>
    <h1>Transaction Detail</h1><p class="muted">All recorded ${escapeHtml(year)} transactions. Expense allocation is calculated from the entered business-use percentage.</p>
    <table class="ledger"><thead><tr><th>Date</th><th>Income/Expense</th><th>Company/source</th><th>Category</th><th>Description</th><th>Amount</th><th>Business use</th><th>Allocated</th><th>Home office</th><th>Notes</th></tr></thead><tbody>${transactionRows || '<tr><td colspan="10">No transactions recorded.</td></tr>'}</tbody></table>
  </body></html>`;
}

function serializeCsv(store, year = store.taxYear) {
  const headers = ['Date', 'Income/Expense', 'Company/source', 'Category', 'Description', 'Amount', 'Business use %', 'Allocated business amount', 'Home office related', 'Notes'];
  const rows = [...transactionsForYear(store, year)].sort((a, b) => a.date.localeCompare(b.date)).map((transaction) => {
    const company = store.companies.find((item) => item.id === transaction.companyId)?.name || 'Unknown company';
    const category = store.categories.find((item) => item.id === transaction.categoryId)?.name || 'Unknown category';
    return [transaction.date, transaction.type === 'income' ? 'Income' : 'Expense', company, category, transaction.description, (transaction.amountCents / 100).toFixed(2), transaction.businessUsePercent ?? '', (businessAmountCents(transaction) / 100).toFixed(2), transaction.homeOfficeRelated ? 'Yes' : 'No', transaction.notes];
  });
  return [headers, ...rows].map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n') + '\r\n';
}

module.exports = { TAX_YEAR, DEFAULT_COMPANIES, DEFAULT_CATEGORIES, createEmptyStore, normalizeStore, validateStore, isValidIsoDate, isValidTaxDate, normalizePercent, businessAmountCents, calculateSummary, formatCurrency, formatPercent, escapeHtml, buildReportHtml, serializeCsv };

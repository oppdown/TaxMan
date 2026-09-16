'use strict';

// The Windows build supplies window.taxLedger from preload.cjs. This adapter
// keeps the same renderer usable in a mobile browser or Capacitor Android app.
if (!window.taxLedger) {
  const STORAGE_KEY = 'taxman.local-store.v1';
  const DEFAULT_COMPANIES = [
    ['company-hart-emc', 'Hart EMC', 'Utility'], ['company-att-mobile', 'AT&T Mobile', 'Utility'],
    ['company-windstream-internet', 'Windstream Internet', 'Utility'], ['company-progressive-car-insurance', 'Progressive Car Insurance', 'Insurance'],
    ['company-chatgpt', 'ChatGPT', 'Vendor'], ['company-ne-georgia-bank', 'NE Georgia Bank', 'Bank'],
    ['company-city-royston-natural-gas', 'City of Royston - Natural Gas', 'Utility'], ['company-franklin-county-water', 'Franklin County Water Department', 'Utility'],
    ['company-theitsupportcenter', 'theITSupportCenter', 'Income source']
  ];
  const DEFAULT_CATEGORIES = [
    ['income-freelance', 'income', 'Freelance / 1099'], ['income-sales', 'income', 'Sales'], ['income-wages', 'income', 'Wages'], ['income-other', 'income', 'Interest / Other'],
    ['expense-utilities', 'expense', 'Utilities'], ['expense-internet-phone', 'expense', 'Internet / Phone'], ['expense-office-supplies', 'expense', 'Office Supplies'],
    ['expense-software', 'expense', 'Software / Subscriptions'], ['expense-advertising', 'expense', 'Advertising'], ['expense-professional-services', 'expense', 'Professional Services'],
    ['expense-insurance', 'expense', 'Insurance'], ['expense-banking-costs', 'expense', 'Banking Costs'], ['expense-travel-vehicle', 'expense', 'Travel / Vehicle'],
    ['expense-home-office', 'expense', 'Home Office'], ['expense-other', 'expense', 'Other']
  ];

  function emptyStore() {
    return { schemaVersion: 1, taxYear: 2025, companies: DEFAULT_COMPANIES.map(([id, name, classification]) => ({ id, name, classification, phone: '', email: '', website: '', notes: '' })), categories: DEFAULT_CATEGORIES.map(([id, type, name]) => ({ id, type, name, active: true })), transactions: [], updatedAt: new Date().toISOString() };
  }
  function normalizeStore(input) {
    const base = emptyStore();
    const source = input && typeof input === 'object' ? input : {};
    return {
      schemaVersion: 1,
      taxYear: Number.isInteger(source.taxYear) ? source.taxYear : base.taxYear,
      companies: Array.isArray(source.companies) ? source.companies.map((item) => ({ id: String(item.id || cryptoId('company')), name: String(item.name || '').trim(), classification: String(item.classification || 'Other'), phone: String(item.phone || ''), email: String(item.email || ''), website: String(item.website || ''), notes: String(item.notes || ''), alwaysHomeOfficeRelated: Boolean(item.alwaysHomeOfficeRelated) })) : base.companies,
      categories: Array.isArray(source.categories) ? source.categories.map((item) => ({ id: String(item.id || cryptoId('category')), type: item.type === 'income' ? 'income' : 'expense', name: String(item.name || '').trim(), active: item.active !== false })) : base.categories,
      transactions: Array.isArray(source.transactions) ? source.transactions.map((item) => ({ ...item, receiptImageData: typeof item.receiptImageData === 'string' ? item.receiptImageData : '' })) : [],
      updatedAt: new Date().toISOString()
    };
  }
  function cryptoId(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
  function download(name, content, type) {
    const blob = new Blob([content], { type });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = name; link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }
  function csv(store, year) {
    const companies = new Map(store.companies.map((item) => [item.id, item.name]));
    const categories = new Map(store.categories.map((item) => [item.id, item.name]));
    const headers = ['Date', 'Income/Expense', 'Company/source', 'Category', 'Description', 'Amount', 'Business use %', 'Allocated business amount', 'Home office related', 'Notes'];
    const rows = store.transactions.filter((item) => item.taxYear === Number(year)).map((item) => [item.date, item.type === 'income' ? 'Income' : 'Expense', companies.get(item.companyId) || 'Unknown company', categories.get(item.categoryId) || 'Unknown category', item.description, ((item.amountCents || 0) / 100).toFixed(2), item.businessUsePercent ?? '', (((item.amountCents || 0) * Number(item.businessUsePercent ?? (item.type === 'expense' ? 100 : 0)) / 100) / 100).toFixed(2), item.homeOfficeRelated ? 'Yes' : 'No', item.notes]);
    return [headers, ...rows].map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n') + '\r\n';
  }
  function chooseJsonFile() {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json';
      input.onchange = async () => { const file = input.files?.[0]; if (!file) return resolve({ canceled: true }); try { resolve({ canceled: false, store: normalizeStore(JSON.parse(await file.text())) }); } catch (error) { reject(error); } };
      input.click();
    });
  }
  window.taxLedger = {
    supportsPhoneCapture: false,
    supportsOcr: false,
    loadStore: async () => { try { return normalizeStore(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')); } catch { return emptyStore(); } },
    saveStore: async (store) => { const normalized = normalizeStore(store); try { localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized)); } catch { throw new Error('The mobile ledger is full. Export a JSON backup, then remove an old photo.'); } return normalized; },
    importJson: chooseJsonFile,
    exportJson: async (store) => { download('taxman-mobile-backup.json', JSON.stringify(normalizeStore(store), null, 2), 'application/json'); return { canceled: false, path: 'taxman-mobile-backup.json' }; },
    exportCsv: async (store, year) => { download(`taxman-${year || 'transactions'}.csv`, csv(normalizeStore(store), year), 'text/csv'); return { canceled: false, path: `taxman-${year || 'transactions'}.csv` }; },
    exportPdf: async () => { window.print(); return { canceled: true }; },
    openFolder: async () => {},
    checkForUpdates: async () => { window.open('https://taxman.speedy-star-8288.chatgpt.site/download.html', '_blank'); },
    getVersion: async () => '0.4.0',
    startPhoneCapture: async () => ({ direct: true }),
    stopPhoneCapture: async () => {},
    readBillPhoto: async () => { throw new Error('Bill reading is available in the installed Windows version of TaxMan.'); },
    onPhoneCaptureUploaded: () => {}
  };
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./service-worker.js').catch(() => {});
}

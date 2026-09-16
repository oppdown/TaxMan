'use strict';

const MONTHS = new Map([
  ['january', 1], ['february', 2], ['march', 3], ['april', 4], ['may', 5], ['june', 6],
  ['july', 7], ['august', 8], ['september', 9], ['october', 10], ['november', 11], ['december', 12]
]);

function normalizeText(value) {
  return String(value || '').replace(/\r/g, '').split('\n').map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

function validDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
}

function extractDate(lines) {
  for (const line of lines) {
    const numeric = line.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
    if (numeric) {
      const year = numeric[3].length === 2 ? 2000 + Number(numeric[3]) : Number(numeric[3]);
      const result = validDate(year, Number(numeric[1]), Number(numeric[2]));
      if (result) return result;
    }
    const named = line.match(/\b([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+(\d{4})\b/);
    if (named) {
      const month = MONTHS.get(named[1].toLowerCase());
      const result = month ? validDate(Number(named[3]), month, Number(named[2])) : '';
      if (result) return result;
    }
  }
  return '';
}

function amountsIn(line) {
  return [...line.matchAll(/(?:\$\s*)?\b\d{1,3}(?:,\d{3})*(?:\.\d{2})\b/g)].map((match) => Math.round(Number(match[0].replace(/[$,\s]/g, '')) * 100)).filter((amount) => Number.isInteger(amount) && amount > 0);
}

function extractAmount(lines) {
  const preferred = lines.filter((line) => /total|amount due|balance due|payment due|due today|grand total/i.test(line)).flatMap(amountsIn);
  const candidates = preferred.length ? preferred : lines.flatMap(amountsIn);
  return candidates.length ? Math.max(...candidates) : 0;
}

function normalizedName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function extractVendor(lines, companies = []) {
  const companyMatch = companies.find((company) => {
    const name = normalizedName(company.name);
    return name && lines.some((line) => normalizedName(line).includes(name));
  });
  if (companyMatch) return { vendor: companyMatch.name, companyId: companyMatch.id };
  const ignored = /total|invoice|receipt|statement|account|customer|address|phone|date|amount|due|www\.|https?:|\d{3,}/i;
  const vendor = lines.find((line) => line.length >= 2 && line.length <= 80 && !ignored.test(line) && /[A-Za-z]{2}/.test(line));
  return { vendor: vendor || '', companyId: '' };
}

function extractCategoryId(lines, categories = []) {
  const text = lines.join(' ').toLowerCase();
  const hints = [
    [/electric|power|water|gas|utility|internet|wifi|mobile|phone|telecom/, ['utility', 'utilities', 'internet', 'phone']],
    [/insurance/, ['insurance']],
    [/software|subscription|app\b/, ['software', 'subscription']],
    [/advertis|marketing/, ['advertising']],
    [/bank|finance|fee|interest/, ['banking', 'financial']],
    [/office|stationery|printer|paper/, ['office']],
    [/travel|hotel|airline|fuel|gas station|mileage/, ['travel', 'vehicle']]
  ];
  for (const [pattern, names] of hints) {
    if (!pattern.test(text)) continue;
    const category = categories.find((item) => names.some((name) => normalizedName(item.name).includes(name)));
    if (category) return category.id;
  }
  return '';
}

function extractBillFields(text, store = {}) {
  const lines = normalizeText(text);
  const { vendor, companyId } = extractVendor(lines, store.companies || []);
  return {
    date: extractDate(lines),
    companyId,
    vendor,
    categoryId: extractCategoryId(lines, store.categories || []),
    description: vendor ? `${vendor} bill` : '',
    amountCents: extractAmount(lines),
    text: lines.join('\n')
  };
}

module.exports = { extractBillFields };
